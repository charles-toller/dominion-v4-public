import Game from "../src/server/Game";
import Player from "../src/server/Player";
import Card from "../src/cards/Card";
import CardRegistry from "../src/cards/CardRegistry";
import {Decision, DecisionDefaults, DecisionResponseType, DecisionValidators} from "../src/server/Decision";
import {Texts} from "../src/server/Texts";
import {Interrupt} from "../testClient/Interrupt";

let playerUnderTest: Player | null = null;

let testedDecisions: Array<[Decision, Error | null]> = [];

export function setPlayerUnderTest(player: Player) {
    playerUnderTest = player;
}

export function getPlayerUnderTestResults() {
    return testedDecisions;
}

export function makeFakeIo(onLog?: (msg: string) => any) {
    return {
        on: () => {},
        emit: (msg, ...args) => {
            if (msg === 'log' && onLog) {
                onLog(args[0]);
            }
        },
        of: () => makeFakeIo(onLog)
    }
}
type DecisionMatcher = (decision: Decision) => boolean;
type PossibleAsync<T> = T | Promise<T>;
export type DecisionResponse = {
    matcher: DecisionMatcher;
    response: (decision) => PossibleAsync<DecisionResponseType[Decision["decision"]]>;
}
let testPlayerIndex = 1;
const WELL_KNOWN_STOP_ERROR = 'WELL_KNOWN_STOP_ERROR';
export class TestPlayer extends Player {
    decisionResponses: Array<DecisionResponse> = [];
    protected optionalDecisionResponses: Array<DecisionResponse> = [];
    username = `Test Player ${testPlayerIndex++}`;
    get hand() {
        return this.data.hand.map((a) => a.name);
    }
    get discardPile() {
        return this.deck.discard.map((a) => a.name);
    }
    get playArea() {
        return this.data.playArea.map((a) => a.name);
    }
    get allCardsTest() {
        return this.allCards.map((a) => a.name);
    }
    get exile() {
        return this.data.exile.map((a) => a.name);
    }
    async makeDecision<T extends Decision>(decision: T): Promise<DecisionResponseType[T["decision"]]> {
        if (playerUnderTest) {
            playerUnderTest.game = this.game;
            try {
                const response = await playerUnderTest.makeDecision(decision);
                try {
                    DecisionValidators[decision.decision](this.game, decision, response);
                    testedDecisions.push([decision, null]);
                }
                catch (e) {
                    console.error(e);
                    throw new Error(`Responded invalidly to decision ${JSON.stringify(decision)}\nResponded with ${JSON.stringify(response)}`);
                }
            }
            catch (e) {
                testedDecisions.push([decision, e]);
            }
        }
        if (decision.decision === 'chooseUsername') {
            return this.username as any;
        }
        const d = DecisionDefaults[decision.decision](decision);
        if (d != null) {
            // We've hit a default situation
            console.log(`Using default response for ${decision.decision}: ${JSON.stringify(d)}`);
            return d as any;
        }
        const rIndex = this.decisionResponses.findIndex((a) => a.matcher(decision));
        const oIndex = this.optionalDecisionResponses.findIndex((a) => a.matcher(decision));
        if (rIndex !== -1 || oIndex !== -1) {
            const responder = rIndex !== -1 ? this.decisionResponses.splice(rIndex, 1)[0] : this.optionalDecisionResponses.splice(oIndex, 1)[0];
            const response = await responder.response(decision);
            if (response instanceof Interrupt) {
                return response as any;
            }
            try {
                DecisionValidators[decision.decision](this.game, decision, response);
            }
            catch (e) {
                // @ts-ignore
                this.game.doneFn(e);
                throw e;
            }
            return response as any;
        }
        // @ts-ignore
        this.game.doneFn(new Error(`Failed to find a response for ${JSON.stringify(decision)}`));
        throw new Error("Failed to find a response.");
    }
    async call(cardName: string, decisions: () => any) {
        this.testHookNextDecision(async () => {
            decisions();
            await this.sendInterrupt('reserve', {
                cardId: this.data.tavernMat.find((a) => a.card.name === cardName)!.card.id
            });
        });
    }
    testInvalid() {
        let responder = -1;
        const response = {
            matcher: (decision) => {
                let tmpResponder = this.decisionResponses.indexOf(response);
                if (this.decisionResponses[tmpResponder + 1].matcher(decision)) {
                    responder = tmpResponder;
                    return true;
                }
                return false;
            },
            response: (decision) => {
                let errored = false;
                let res = this.decisionResponses[responder].response(decision);
                try {
                    DecisionValidators[decision.decision](this.game, decision, res);
                }
                catch (e) {
                    // We're expecting an error
                    errored = true;
                }
                // Remove the next decision responder, as we've already handled it
                this.decisionResponses.splice(responder, 1);
                if (!errored) {
                    // @ts-ignore
                    this.game.doneFn(new Error("Response should have been invalid: " + JSON.stringify(res)));
                    return res;
                }
                else {
                    console.log("Task failed successfully, moving on")
                    return TestPlayer.prototype.makeDecision.apply(this, [decision]);
                }
            }
        };
        this.decisionResponses.push(response);
        return this;
    }
    testHookNextDecision(cb: (decision: Decision) => any) {
        let isOptional = false;
        const response = {
            matcher: (decision) => {
                if (this.decisionResponses[this.decisionResponses.indexOf(response) + 1].matcher(decision)) {
                    return true;
                }
                if (this.decisionResponses.slice(this.decisionResponses.indexOf(response) + 1).every((a) => !a.matcher(decision)) && this.optionalDecisionResponses[0]?.matcher(decision)) {
                    isOptional = true;
                    return true;
                }
                return false;
            },
            response: async (decision) => {
                let r;
                if (!isOptional) {
                    r = this.decisionResponses.splice(this.decisionResponses.indexOf(response) + 1, 1)[0];
                }
                else {
                    r = this.optionalDecisionResponses.splice(0, 1)[0];
                }
                try {
                    await cb(decision);
                }
                catch (e) {
                    // @ts-ignore
                    this.game.doneFn(e);
                }
                return r.response(decision);
            }
        };
        this.decisionResponses.push(response);
    }
    testPlayAction(actionName: string) {
        this.decisionResponses.push({
            matcher: (decision) => decision.decision === 'chooseCard' && decision.helperText === Texts.chooseActionToPlay,
            response: (decision) => decision.source.find((a) => a.name === actionName) as any
        })
    }
    testPlayWay(wayName: string, actionToUse: string) {
        this.decisionResponses.push({
            matcher: (decision) => (decision.decision === 'chooseCard' && decision.waysAvailable) || (decision.decision === 'chooseCardOrBuy'),
            response: async (decision) => {
                const card = decision.source.find((a) => a.name === actionToUse)!;
                await this.sendInterrupt('way', {
                    cardId: card.id,
                    asWay: wayName
                });
                return card as any;
            }
        });
    }
    testConfirmWay(wayName: string) {
        this.decisionResponses.push({
            matcher: (decision) => decision.decision === 'chooseOption' && decision.helperText === Texts.chooseAnXEffectToRunNext('on play'),
            response: (decision) => {
                return {
                    choice: decision.options.find((a) => a === wayName)
                };
            }
        });
    }
    testChooseCard(text: string, card: string) {
        this.decisionResponses.push({
            matcher: (decision) => decision.decision === 'chooseCard' && decision.helperText === text,
            response: (decision) => decision.source.find((a) => a.name === card) as any,
            extra: text,
            card
        } as any);
    }
    throneRoomTarget(card: string) {
        this.decisionResponses.push({
            matcher: (decision) => decision.decision === 'chooseCard' && decision.helperText === Texts.chooseCardToPlayTwice,
            response: (decision) => decision.source.find((a) => a.name === card)
        });
    }
    testReveal(card: string, shouldReveal = true) {
        this.decisionResponses.push({
            matcher: (decision) => decision.decision === 'confirm' && decision.helperText === Texts.doYouWantToReveal('moat'),
            response: () => shouldReveal
        });
    }
    testConfirm(text: string, confirm: boolean) {
        this.decisionResponses.push({
            matcher: (decision) => decision.decision === 'confirm' && decision.helperText === text,
            response: () => confirm
        });
    }
    testGain(forCard: string, gainCard: string) {
        this.decisionResponses.push({
            matcher: (decision) => decision.decision === 'gain' && (decision.helperText === Texts.chooseCardToGainFor(forCard) || decision.helperText === forCard),
            response: () => {
                const pile = this.game.supply.data.piles.find((a) => a.pile.length > 0 && a.pile[a.pile.length - 1].name === gainCard);
                if (!pile) {
                    throw new Error("Asked to find non-existent pile")
                }
                return pile.pile[pile.pile.length - 1];
            }
        });
    }
    testPlayTreasure(card: string) {
        this.decisionResponses.push({
            matcher: (decision) => decision.decision === 'chooseCardOrBuy',
            response: (decision) => ({responseType: 'playCard', choice: decision.source.find((a) => a.name === card)})
        });
    }
    testBuy(card: string) {
        this.decisionResponses.push({
            matcher: (decision) => decision.decision === 'chooseCardOrBuy' || decision.decision === 'buy',
            response: () => ({responseType: 'buy', choice: {name: card, id: this.game.supply.data.piles.find((a) => a.pile.length > 0 && a.pile[0].name === card)!.pile[0].id}})
        });
    }
    testOption(text: string, option: string | number) {
        this.decisionResponses.push({
            matcher: (decision) => decision.decision === 'chooseOption' && decision.helperText === text,
            response: (decision) => {
                return {
                    choice: decision.options.find((a, i) => a === option || i === option)
                }
            }
        });
    }
    testHookEndTurn(cb: () => any) {
        const lastDecision = this.decisionResponses[this.decisionResponses.length - 1];
        if (!lastDecision) {
            throw new Error("testHookEndTurn called without a decision to hook onto!");
        }
        const oldResponse = lastDecision.response;
        lastDecision.response = (decision) => {
            this.events.on('test_turnEndHooks', () => {
                try {
                    cb();
                }
                catch (e) {
                    // @ts-ignore
                    this.game.doneFn(e);
                }
                return false;
            });
            return oldResponse(decision);
        }
    }
    testReorderSame(text: string) {
        this.decisionResponses.push({
            matcher: (decision) => decision.decision === 'reorder' && decision.helperText === text,
            response: (decision) => {
                return {
                    order: decision.cards
                }
            }
        });
    }
    testEndGame() {
        this.decisionResponses.push({
            matcher: (decision) => decision.decision === 'chooseCardOrBuy' || decision.decision === 'buy',
            response: (decision) => {
                (this.game as TestGame).done = true;
                if (decision.decision === 'chooseCardOrBuy') {
                    return {
                        responseType: 'buy',
                        choice: {
                            name: 'End Turn',
                            id: ''
                        }
                    }
                }
                if (decision.decision === 'buy') {
                    return {
                        choice: {
                            name: 'End Turn',
                            id: ''
                        }
                    }
                }
                return ({responseType: 'buy', choice: {name: 'End Turn', id: ''}});
            }
        });
    }
    testEndGameNow() {
        this.decisionResponses.push({
            matcher: () => true,
            response: () => {
                throw new Error(WELL_KNOWN_STOP_ERROR);
            }
        })
    }
    optional(cb: () => any) {
        const oldReponses = this.decisionResponses;
        this.decisionResponses = [];
        cb();
        this.optionalDecisionResponses = [...this.optionalDecisionResponses, ...this.decisionResponses];
        this.decisionResponses = oldReponses;
    }
    endTurn() {
        this.decisionResponses.push({
            matcher: (decision) => decision.decision === 'chooseCardOrBuy' || decision.decision === 'buy',
            response: () => ({responseType: 'buy', choice: {name: 'End Turn', id: ''}})
        });
    }
    onBuyPhaseStart(cb: () => any) {
        this.decisionResponses.push({
            matcher: (decision) => decision.decision === 'chooseCardOrBuy' || decision.decision === 'buy',
            response: () => {
                try {
                    cb();
                }
                catch (e) {
                    // @ts-ignore
                    this.game.doneFn(e);
                }
                return {responseType: 'buy', choice: {name: 'End Turn', id: ''}};
            }
        });
    }
    private onScoreCb: null | ((score: number) => any) = null;
    onScore(cb: (score: number) => any) {
        this.onScoreCb = cb;
    }
    score(): { [p: string]: number } {
        const b = super.score();
        if (this.onScoreCb) {
            try {
                this.onScoreCb(Object.values(b).reduce((total, val) => total + val, 0));
            }
            catch (e) {
                // @ts-ignore
                this.game.doneFn(e);
            }
            this.onScoreCb = null;
        }
        return b;
    }
}
class DrawAttack extends Card {
    randomizable = false;
    cardText = "";
    intrinsicCost = {
        coin: 5
    };
    intrinsicTypes = ["action", "attack"] as const;
    name = "attack";
    supplyCount = 10;
    cardArt = "";
    async onPlay(player: Player, exemptPlayers: Player[]): Promise<void> {
        await player.attackOthersInOrder(exemptPlayers, async (player) => {
            await player.draw(1, false);
        });
    }
}
let emptyNameId = 0;
function createEmptySupplyPileCard() {
    let name = `Empty${emptyNameId}`;
    return class extends Card {
        randomizable = false;
        cardText = "";
        intrinsicCost = {
            coin: 0
        };
        intrinsicTypes = ["action"] as const;
        name = name;
        supplyCount = 0;
        cardArt = "";
        async onPlay(): Promise<void> {

        }
    }
}
export class TestGame extends Game {
    done = false;
    private doneFn: (error?) => any = null as any;
    private resolvePromise!: () => any;
    private rejectPromise!: (err) => any;
    private donePromise = new Promise<void>((f, r) => {
        this.resolvePromise = f;
        this.rejectPromise = r;
    });
    setDone(done: (error?) => any) {
        this.doneFn = (error?) => {
            this.done = true;
            if (error) {
                this.rejectPromise(error);
                done(error);
            }
            else if ((this.players as TestPlayer[]).filter((a) => a.decisionResponses.length).length) {
                done(new Error("Player had decisions left when game ended"));
            }
            else {
                this.resolvePromise();
                done();
            }
        };
        return this.doneFn;
    }
    gameEnded(): boolean {
        return this.done;
    }
    injectTestAttack() {
        CardRegistry.getInstance().injectCard(DrawAttack as any);
        this.selectedCards.push('attack');
    }

    injectEmptySupplyPile() {
        const card = createEmptySupplyPileCard() as any;
        CardRegistry.getInstance().injectCard(card);
        this.selectedCards.push(card.cardName);
    }

    determineTurnOrder() {
        // Retain default ordering
    }
    onAccountabilityFailure(missingIds: string[], extraIds: string[]) {
        this.doneFn(new Error(`The following ids were missing: ${missingIds.join(", ")}\nThe following ids were created or duplicated: ${extraIds.join(", ")}`));
    }
    start() {
        super.start().then(() => {
            if (!this.done) {
                this.resolvePromise();
            }
        }).catch((e: Error) => {
            if (e.message !== WELL_KNOWN_STOP_ERROR) {
                this.doneFn(e);
            }
            else if (!this.done) {
                this.doneFn();
            }
        });
        return this.donePromise;
    }
}
export default function makeTestGame({
    players = 1,
    decks = [[]] as string[][],
    discards = [[]] as string[][],
    activateCards = [] as string[],
    d = () => {},
    params = {} as {[name: string]: string}
                                     }): [TestGame, TestPlayer[], (err?) => any] {
    if (typeof globalThis.testGameImpl !== 'undefined') {
        return globalThis.testGameImpl({
            players,
            decks,
            discards,
            activateCards,
            d
        });
    }
    let game: TestGame;
    if (typeof globalThis.testGameCreator !== 'undefined') {
        game = globalThis.testGameCreator();
    }
    else {
        game = new TestGame(makeFakeIo((msg) => {
            console.log(msg)
        }) as any);
    }
    game.params = params;
    if (decks.some((a) => a.includes("attack"))) {
        game.injectTestAttack();
    }
    if (discards.some((a) => a.includes("attack"))) {
        game.injectTestAttack();
    }
    game.setCards({emit: () => {}} as any,
        [
            ...decks.reduce((full, deck) => [...full, ...deck], []),
            ...discards.reduce((full, discard) => [...full, ...discard], []),
            ...activateCards
        ].filter((a, i, arr) => arr.indexOf(a) === i),
        params,
        ''
    );
    for (let i = 0; i < players; i++) {
        const player = new (typeof globalThis.testPlayerPrototype !== 'undefined' ? globalThis.testPlayerPrototype : TestPlayer)(game);
        let deck = [] as Card[];
        for (const cardName of (decks[i] || [])) {
            deck.push(
                new (CardRegistry.getInstance().getCard(cardName))(game)
            );
        }
        player.deck.setCards(deck);
        let discard = [] as Card[];
        for (const cardName of (discards[i] || [])) {
            discard.push(
                new (CardRegistry.getInstance().getCard(cardName))(game)
            );
        }
        player.deck.discard = discard;
        player.data.hand = [];
        // @ts-ignore
        player.startDraw();
        player.deck.shouldShuffle = false;
        game.players.push(player);
    }
    const done = game.setDone(d);
    return [game, game.players as TestPlayer[], done];
}