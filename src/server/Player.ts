import v4 = require("uuid/v4");
import Deck from "./Deck";
import type {Socket} from "socket.io";
import type Game from "./Game";
import createPlayerData from "../createPlayerData";
import {Decision, DecisionDefaults, DecisionResponseType, DecisionValidators} from "./Decision";
import {GainRestrictions} from "./GainRestrictions";
import type Card from "../cards/Card";
import {Texts} from "./Texts";
import CardRegistry from "../cards/CardRegistry";
import {PlayerEvents} from "./Events";
import Util from "../Util";
import Rules from "./Rules";
import Tracker from "./Tracker";
import Cost from "./Cost";
import {struct} from "superstruct";
import PlayerEffects from "./PlayerEffects";
import type CardHolder from "./CardHolder";
import type Way from "../cards/Way";
import {isOriginal} from "../cards/Card";

export default class Player {
    id = v4();
    deck = new Deck(this);
    private _currentSocket: Socket | null = null;
    username = '';
    private waitingForResponse = false;
    data = createPlayerData();
    private decisionCallbacks: {
        [key: string]: Array<(response: any) => any> | undefined;
    } = {};
    private interruptHooks: {[key: string]: (data) => Promise<any>} = {};
    private pendingDecisions: Decision[] = [];
    private _duplicatedPlayArea: Card[] = [];
    turnNumber = 0;
    game: Game;
    events: PlayerEvents = new PlayerEvents();
    effects: PlayerEffects = new PlayerEffects(this);
    private _nextDecisionId = 0;
    isInterrupted = false;
    cardHolders: CardHolder[] = [];
    get nextDecisionId(): string {
        return "" + this._nextDecisionId++;
    }
    constructor(game: Game) {
        this.game = game;
        this.deck.discard = Rules.getStartingCards(this.game.randomizedCards!).map((a) => new a(this.game));
        this.startDraw();
        if (this.game.selectedCards.some((card) => CardRegistry.getInstance().getCard(card).features.includes('vp'))) {
            this.data.dataViews.push('vp');
        }
        if (this.game.selectedCards.some((card) => CardRegistry.getInstance().getCard(card).features.includes('coffers'))) {
            this.data.dataViews.push('coffers');
        }
        if (this.game.selectedCards.some((card) => CardRegistry.getInstance().getCard(card).features.includes('villagers'))) {
            this.data.dataViews.push('villagers');
        }
        if (this.game.selectedCards.some((card) => CardRegistry.getInstance().getCard(card).features.includes('exile'))) {
            this.data.dataViews.push('exile');
            this.effects.setupEffect('gain', 'exile', {
                compatibility: {
                    duplicate: true,
                    'travelling fair': true,
                    'royal seal': true,
                    watchtower: true,
                    'cargo ship': true,
                    innovation: true
                },
                relevant: (ctx, card) => this.data.exile.find((a) => a.name === card.viewCard().name) != null
            }, async (remove, cardTracker) => {
                if (await this.confirmAction(Texts.wantDiscardFromExile(cardTracker.viewCard().name))) {
                    await this.discard(this.data.exile.filter((a) => a.name === cardTracker.viewCard().name), true);
                    this.data.exile = this.data.exile.filter((a) => a.name !== cardTracker.viewCard().name);
                }
            });
        }
        if (this.game.selectedCards.some((card) => CardRegistry.getInstance().getCard(card).types.includes('reserve') || CardRegistry.getInstance().getCard(card).features.includes('tavernMat'))) {
            this.data.dataViews.push('tavernMat');
        }
        if (this.game.selectedCards.some((card) => CardRegistry.getInstance().getCard(card).tokens.includes('minusOneCoin'))) {
            if (typeof this.data.hooks.money === 'undefined') {
                this.data.hooks.money = [];
            }
            this.data.hooks.money.push((oldValue, amount) => {
                if (this.data.tokens.minusOneCoin && (amount - oldValue) > 0) {
                    this.lm("(%p loses their -$1 token.)");
                    this.data.tokens.minusOneCoin = false;
                    return amount - 1;
                }
                return amount;
            });
        }
        this.data.tokenViews.push(...this.game.selectedCards.flatMap((card) => CardRegistry.getInstance().getCard(card).tokens).filter((a, i, arr) => arr.indexOf(a) === i));
    }
    private startDraw() {
        while (this.data.hand.length < 5 && this.deck.deckAndDiscard.length > 0) {
            let card = this.deck.cards.shift();
            if (!card) {
                // @ts-ignore
                this.deck._fastShuffle();
                card = this.deck.cards.shift()!;
            }
            this.data.hand.push(card);
        }
    }

    async addMoney(amount: number) {
        this.data.money += amount;
    }

    async removeMoney(amount: number) {
        if (this.data.money < amount) {
            throw new Error("Tried to remove more money than we have.");
        }
        this.data.money -= amount;
    }


    // noinspection JSUnusedLocalSymbols
    async draw(amount: number, plusCards: boolean) { // eslint-disable-line @typescript-eslint/no-unused-vars
        if (amount > 0 && this.data.tokens.minusOneCard) {
            this.lm("(%p loses their -1 Card token.)");
            this.data.tokens.minusOneCard = false;
            amount--;
        }
        const cards: Card[] = [];
        let card: Card | undefined;
        while (cards.length < amount && (card = await this.deck.pop()) !== undefined) {
            cards.push(card);
        }
        if (cards.length) {
            this.lm('%p draws %hl.', cards);
            this.data.hand.push(...cards);
        }
        else {
            this.lm('There are no more cards for %p to draw!');
        }
    }
    get allCards() {
        return [...this.deck.deckAndDiscard, ...this.data.hand, ...this.data.playArea, ...this.data.tavernMat.map((a) => a.card), ...this.cardHolders.flatMap((a) => a.getCards()), ...this.data.exile];
    }
    get currentSocket() {
        return this._currentSocket;
    }
    set currentSocket(socket: Socket | null) {
        this._currentSocket = socket;
        if (socket == null) {
            return;
        }
        socket.emit('playerState', this.data.getState());
        socket.emit('gameState', this.game.data.getState());
        this.data.onAction((action) => {
            socket.emit('playerStateUpdate', action);
            return true;
        });
        this.game.data.onAction((action) => {
            socket.emit('gameDataUpdate', action);
            return true;
        });
        this.game.supply.data.onAction((action) => {
            socket.emit('supplyUpdate', action);
            return true;
        });
        socket.on('fetchSupply', (returnTo) => {
            socket.emit(returnTo, this.game.supply.data.getState());
        });
        socket.on('interrupt', async (hookName, data) => {
            await this.sendInterrupt(hookName, data);
        });
        socket.on('decisionResponse', (decisionId, response) => {
            const decision = this.pendingDecisions.find((a) => a.id === decisionId);
            if (!decision) {
                console.log('Attempt to respond to a undefined decision, return');
                this.waitingForResponse = false;
                this.emitNextDecision();
                return;
            }
            let r;
            try {
                r = DecisionValidators[decision.decision](this.game, decision, response);
            }
            catch (e) {
                if (e.errors) {
                    console.error(`Error validating ${JSON.stringify(response)}: ${e.errors[0].message}`);
                }
                // We have a problem with the response, re-emit the decision for another try
                this.emitNextDecision();
                return;
            }
            this.events.emit('decision');
            const callbacks = this.decisionCallbacks[decisionId];
            if (callbacks) {
                callbacks.forEach((a) => {
                    try {
                        a(r);
                    }
                    catch (e) {
                        console.error("An error was thrown during execution of a decision callback:");
                        console.error(e);
                    }
                });
            }
            // Prevent duplicate decisionResponse
            delete this.decisionCallbacks[decisionId];
            this.waitingForResponse = false;
            this.pendingDecisions.shift();
            if (this.pendingDecisions.length) {
                this.emitNextDecision();
            }
        });
        socket.on('startGame', () => {
            this.game.start();
        });
        if (this.pendingDecisions.length) {
            this.emitNextDecision();
        }
    }
    async sendInterrupt(hookName: string, data: any) {
        this.isInterrupted = true;
        const interruptedDecisions = this.pendingDecisions;
        this.pendingDecisions = [];
        this.waitingForResponse = false;
        await (this.interruptHooks[hookName])?.(data);
        this.pendingDecisions = interruptedDecisions;
        this.isInterrupted = false;
        this.emitNextDecision();
    }
    private static reserveStruct = struct({
        cardId: 'string'
    });
    ensureReserveInterrupt() {
        if (typeof this.interruptHooks["reserve"] === 'undefined') {
            this.interruptHooks["reserve"] = async (data) => {
                const newData = Player.reserveStruct(data);
                const card = this.data.tavernMat.find((a) => a.card.id === newData.cardId);
                if (card) {
                    await this.callReserve(card.card);
                }
            };
        }
    }
    private static wayStruct = struct({
        cardId: 'string',
        asWay: 'string'
    });
    private nextAsWay: {id: string; way: string} | null = null;
    ensureWayInterrupt() {
        if (typeof this.interruptHooks["way"] === 'undefined') {
            this.interruptHooks["way"] = async (data) => {
                const newData = Player.wayStruct(data);
                this.nextAsWay = {
                    id: newData.cardId,
                    way: newData.asWay
                };
            };
        }
    }
    async callReserve(card: Card) {
        await card.call(this);
    }
    makeDecision<T extends Decision>(decision: T): Promise<DecisionResponseType[T['decision']]> {
        const defaultR = DecisionDefaults[decision.decision](decision);
        if (defaultR) {
            return Promise.resolve(defaultR as any);
        }
        return new Promise((f) => {
            this.pendingDecisions.push(decision);
            const toPush = this.decisionCallbacks[decision.id] || [];
            toPush.push(f);
            this.decisionCallbacks[decision.id] = toPush;
            if (!this.waitingForResponse && this.currentSocket && this.currentSocket.connected) {
                this.emitNextDecision();
            }
        });
    }
    emitNextDecision() {
        if (this.pendingDecisions.length && this.currentSocket && this.currentSocket.connected) {
            this.currentSocket.emit('decision', this.pendingDecisions[0]);
            this.waitingForResponse = true;
        }
    }
    sendLog(logMsg: string) {
        if (this.currentSocket && this.currentSocket.connected) {
            this.currentSocket.emit('log', logMsg);
        }
    }
    async chooseUsername() {
        this.username = await this.makeDecision({
            decision: "chooseUsername",
            id: this.nextDecisionId,
            helperText: Texts.chooseUsername
        });
    }
    notifyPlayerCount() {
        this.currentSocket && this.currentSocket.emit('playerCount', this.game.players.length);
    }
    lm(msg: string, ...params: any[]) {
        const nMsg = msg.replace(/%p/g, this.username);
        this.game.lm(this, nMsg, ...params);
    }
    private getBuyRestrictions() {
        return this.game.addAdditionalBuyRestrictions(
            this,
            GainRestrictions.instance()
                .setUpToCost(Cost.create(this.data.money + this.data.coffers))
                .setIsCard(false)
        ).build(this.game);
    }
    private async confirmBuyIfCoffers(response: DecisionResponseType["chooseCardOrBuy"] | DecisionResponseType["buy"]): Promise<boolean> {
        const cost = this.game.getCostOfCard(response.choice.name).coin;
        if (cost > this.data.money) {
            return await this.confirmAction(Texts.buyingWillUseCoffers(response.choice.name, cost - this.data.money));
        }
        return true;
    }
    async chooseCardOrBuy(): Promise<DecisionResponseType["chooseCardOrBuy"]> {
        const response = await this.makeDecision({
            decision: 'chooseCardOrBuy',
            id: v4(),
            source: this.data.hand,
            gainRestrictions: this.getBuyRestrictions(),
            helperText: Texts.chooseCardOrBuy
        });
        if (response.responseType === 'buy' && !await this.confirmBuyIfCoffers(response)) {
            return this.chooseCardOrBuy();
        }
        else {
            return response;
        }
    }
    async chooseBuy(): Promise<DecisionResponseType["buy"]> {
        const response = await this.makeDecision({
            decision: 'buy',
            id: v4(),
            gainRestrictions: this.getBuyRestrictions(),
            helperText: Texts.buy
        });
        if (!await this.confirmBuyIfCoffers(response)) {
            return this.chooseBuy();
        }
        else {
            return response;
        }
    }
    lastTurnMine = false;
    async playTurn(logExtra = "") {
        this.turnNumber++;
        this.data.buys = 1;
        this.data.money = 0;
        this.data.actions = 1;
        this.boughtCards = [];
        this.gainedCards = [];
        this.trashedCards = [];
        this.lm(`%p's turn %s%s`, this.turnNumber, logExtra);
        this.data.isMyTurn = true;
        this.game.updateCostModifiers();
        await this.events.emit('turnStart');
        await this.effects.doEffect('turnStart', Texts.chooseAnXEffectToRunNext('start of turn'), []);
        while (this.nextPhase != null) {
            await this.runNextPhase();
        }
        this.nextPhase = "action";
        this.currentPhase = null;
        await this.events.emit('turnEnd');
        await this.effects.doEffect('turnEnd', Texts.chooseAnXEffectToRunNext('turnEnd'), []);
        await this.events.emit('test_turnEndHooks');
        this.lastTurnMine = true;
        await this.effects.doEffect('afterTurn', Texts.chooseAnXEffectToRunNext('after turn'), []);
        this.data.isMyTurn = false;
    }
    protected exitPhaseNow = false;
    returnToPhase(phase: "buy" | "action") {
        if (!this.data.isMyTurn) return;
        this.exitPhaseNow = true;
        this.nextPhase = phase;
    }
    currentPhase: "action" | "buy" | "cleanup" | null = null;
    protected nextPhase: "action" | "buy" | "cleanup" | null = "action";
    protected async runNextPhase() {
        this.exitPhaseNow = false;
        this.currentPhase = this.nextPhase;
        if (this.nextPhase === "action") {
            this.nextPhase = "buy";
            await this.actionPhase();
        }
        else if (this.nextPhase === "buy") {
            this.nextPhase = "cleanup";
            await this.buyPhase();
        }
        else if (this.nextPhase === "cleanup") {
            this.nextPhase = null;
            await this.cleanup();
        }
    }
    async cleanup() {
        await this.events.emit('cleanupStart');
        await this.effects.doEffect('cleanupStart', Texts.chooseAnXEffectToRunNext('on cleanup'), []);
        await this.data.haltNotifications(async () => {
            for (let i = 0; i < this.data.playArea.length; i++) {
                const card = this.data.playArea[i];
                const dupCard = this._duplicatedPlayArea.filter((a) => a.id === card.id);
                if (card.shouldDiscardFromPlay() && (!dupCard || dupCard.every((a) => a.shouldDiscardFromPlay()))) {
                    this.data.playArea.splice(i, 1);
                    if (dupCard.length) {
                        this._duplicatedPlayArea = this._duplicatedPlayArea.filter((a) => a.id !== card.id);
                    }
                    await this.discard(card, false, false);
                    const tracker = new Tracker(card);
                    tracker.canExercise(() => this.deck.discard[this.deck.discard.length - 1].id === card.id);
                    tracker.onExercise(() => {
                        this.deck.discard.pop();
                    });
                    await this.effects.doMultiEffect(['discard', 'discardFromPlay'], Texts.chooseAnXEffectToRunNext('on discard'), [
                        {
                            effectName: 'discardFromPlay',
                            effect: async (unsub, tracker) => {
                                unsub();
                                await card.onDiscardFromPlay(this, tracker);
                            },
                            config: {
                                // If nothing is happening during this card's onDiscardFromPlay, don't bother
                                // @ts-ignore
                                compatibility: card.onDiscardFromPlay.__original ? () => true : {}
                            },
                            id: v4(),
                            name: card.name
                        }
                    ], tracker);
                    i--;
                }
            }
            const hand = [...this.data.hand];
            this.data.hand = [];
            for (const card of hand) {
                await this.discard(card);
            }
            await this.events.emit('handDraw');
            await this.effects.doEffect('handDraw', Texts.chooseAnXEffectToRunNext('on hand draw'), []);
            await this.draw(5, false);
        });
    }
    async actionPhase() {
        while ((this.data.actions + this.data.villagers) > 0 && this.data.hand.filter((a) => a.types.includes('action')).length > 0) {
            const card = await this.chooseCardFromHand(Texts.chooseActionToPlay, true, (card) => card.types.includes("action"), true);
            if (card) {
                if (this.data.actions === 0 && !await this.confirmAction(Texts.playActionWillUseVillagers(card.name))) {
                    this.data.hand.push(card);
                    continue;
                }
                else if (this.data.actions === 0) {
                    this.data.villagers--;
                }
                else {
                    this.data.actions--;
                }
                this.data.playArea.push(card);
                await this.playCard(card, null, true, true);
                if (this.exitPhaseNow) {
                    break;
                }
            }
            else {
                break;
            }
        }
    }

    /**
     * This function already expects the given card to be in the playArea
     * (Note that this is not necessarily true, for example, if Feast trashes itself during a Throne Room, this will be called,
     * but the card will be in the trash.
     * @param card
     * @param tracker
     * @param log
     * @param naturalPlay - This is a weirdly named parameter, but it's the best I could come up with. Essentially, did the player choose this card to play
     * directly (over something like a Way), or did something like Throne Room play it instead? If it's the latter, we need to prompt on EACH PLAY whether to use
     * the Way or not. Very important.
     */
    async playCard(card: Card, tracker: Tracker<Card> | null, log = true, naturalPlay = false): Promise<Tracker<Card>> {
        if (log) {
            if (this.nextAsWay && this.nextAsWay.id === card.id) {
                this.lm('%p plays %s as %s.', Util.formatCardList([card.name]), this.nextAsWay.way);
            }
            else {
                this.lm('%p plays %s.', Util.formatCardList([card.name]));
            }
        }
        const exemptPlayers = card.types.includes("attack") ? await this.getExemptPlayers(card): [] as Player[];
        await this.events.emit('willPlayCard', card);
        await this.effects.doEffect('willPlayCard', Texts.chooseAnXEffectToRunNext('before card is played'), [], card);
        if (tracker == null) {
            tracker = this.getTrackerInPlay(card);
        }
        const pile = card.getPileIdentifier();
        if (this.data.tokens.extraAction === pile) {
            this.data.actions++;
        }
        if (this.data.tokens.extraBuy === pile) {
            this.data.buys++;
        }
        if (this.data.tokens.extraCard === pile) {
            await this.draw(1, true);
        }
        if (this.data.tokens.extraMoney === pile) {
            this.data.money++;
        }
        let way;
        if (card.types.includes("action") && this.nextAsWay && this.nextAsWay.id === card.id && (way = this.game.getCard(this.nextAsWay.way)) != null && way.types.includes("way")) {
            this.nextAsWay = null;
            await (way as unknown as typeof Way).getInstance(this).onWay(this, exemptPlayers, tracker);
        }
        else {
            await this.effects.doEffect('play', Texts.chooseAnXEffectToRunNext('on play'), [
                {
                    config: {
                        compatibility: {},
                        requiresUnconsumed: true
                    },
                    effect: async (remove, tracker) => {
                        remove.consumed = true;
                        await card.onPlay(this, exemptPlayers, tracker);
                    },
                    effectName: 'play',
                    id: v4(),
                    name: card.name
                }
            ], tracker, naturalPlay);
        }
        await this.events.emit('cardPlayed', tracker);
        await this.game.events.emit('cardPlayed', this, tracker);
        await this.effects.doEffect('cardPlayed', Texts.chooseAnXEffectToRunNext('on action card played'), [], tracker);
        return tracker;
    }

    /**
     * This function allows you to replay a action card that is already in play (even if "already in play" means played and trashed, like feast)
     * This essentially duplicates the card and stores the duplicate internally so it can "wake up" on events, but things that counting things in the
     * play area will not see the duplicate.
     * This returns the duplicate card if you need it for things like determining when a Throne Room should be discarded.
     * @param card
     * @param tracker
     * @param log
     */
    async replayActionCard(card: Card, tracker: Tracker<Card>, log = true): Promise<Card> {
        if (log) {
            this.lm('%p replays the %s.', card.name);
        }
        // We create a duplicate card with the same ID, and call it's play function. This way, it can find itself,
        // but have an independent version of data and everything else.
        // @ts-ignore
        const duplicateCard = new card.constructor(this.game) as Card;
        duplicateCard.id = card.id;
        // This informs the card (if it has such a property) that it is being played under a throne room instead of under normal conditions.
        // This should only be used for extremely exceptional cases, such as the extra Throne Rooms in a chain being discarded regardless of the results of their children,
        // but the first Throne Room remaining out.
        // This would not be a good candidate for "when this is in play" effects that are much better handled as a setup side effect.
        if (typeof (duplicateCard as any)._isUnderThroneRoom !== 'undefined') {
            (duplicateCard as any)._isUnderThroneRoom = true;
        }
        this._duplicatedPlayArea.push(duplicateCard);
        await this.playCard(duplicateCard, tracker, false);
        return duplicateCard;
    }
    async getExemptPlayers(attackingCard: Card): Promise<Player[]> {
        const exemptPlayers = [] as Player[];
        const playersToCheck = this.game.players.filter((a) => a != this);
        for (const player of playersToCheck) {
            if (await player.onAttack(this, attackingCard)) {
                exemptPlayers.push(player);
            }
        }
        return exemptPlayers;
    }
    async onAttack(attacker: Player, attackingCard: Card): Promise<boolean> {
        let exempt = false;
        const handledCardsHand: Card[] = [];
        while (this.data.hand.some((a) => !handledCardsHand.includes(a))) {
            const card = this.data.hand.find((a) => !handledCardsHand.includes(a))!;
            exempt = (await card.onAttackInHand(this, attacker, attackingCard, exempt)) || exempt;
            handledCardsHand.push(card);
        }
        const handledCardsPlay: Card[] = [];
        while (this.data.playArea.some((a) => !handledCardsPlay.includes(a))) {
            const card = this.data.playArea.find((a) => !handledCardsPlay.includes(a))!;
            exempt = (await card.onAttackInPlay(this, attacker, attackingCard, exempt)) || exempt;
            handledCardsPlay.push(card);
        }
        return exempt;
    }
    async buyPhase() {
        await this.events.emit('buyStart');
        await this.game.events.emit('buyStart');
        await this.effects.doEffect('buyStart', Texts.chooseAnXEffectToRunNext('on buy phase start'), []);
        chooseBuy: {
            while (this.data.buys > 0 && this.data.hand.filter((a) => a.types.includes('treasure')).length > 0) {
                const choice = await this.chooseCardOrBuy();
                if (choice.choice.name === 'End Turn') break chooseBuy;
                if (choice.responseType === "playCard") {
                    const handIndex = this.data.hand.findIndex((a) => a.id === choice.choice.id);
                    if (handIndex !== -1) {
                        if (this.data.hand[handIndex].types.indexOf("treasure") === -1) {
                            continue;
                        }
                        const c = this.data.hand.splice(handIndex, 1)[0];
                        this.data.playArea.push(c);
                        await this.playCard(c, null, true, true);
                    }
                    if (this.exitPhaseNow) {
                        break;
                    }
                } else {
                    await this.buy(choice.choice.name);
                    break;
                }
            }
            if (this.exitPhaseNow) {
                // Ruling here: http://wiki.dominionstrategy.com/index.php/Villa
                // Ending your buy phase by returning to your action phase does not trigger "end of Buy phase" triggers
                return;
            }
            while (this.data.buys > 0) {
                const choice = await this.chooseBuy();
                if (choice.choice.name === 'End Turn') break;
                await this.buy(choice.choice.name);
                if (this.exitPhaseNow) return;
            }
        }
        await this.effects.doEffect('buyEnd', Texts.chooseAnXEffectToRunNext('end of Buy phase'), []);
    }
    boughtCards: Card[] = [];
    async buy(cardName: string) {
        this.lm('%p buys %s.', Util.formatCardList([cardName]));
        await this.game.events.emit('buy', this, cardName);
        await this.events.emit('buy', cardName);
        await this.effects.doEffect('buy', Texts.chooseAnXEffectToRunNext('on buy'), [], cardName);
        let cofferAmount = this.game.getCostOfCard(cardName).coin - this.data.money;
        if (cofferAmount > 0) {
            this.lm('%p uses %s coffers.', cofferAmount);
            this.data.coffers -= cofferAmount;
        }
        else {
            cofferAmount = 0;
        }
        this.data.money -= this.game.getCostOfCard(cardName).coin - cofferAmount;
        this.data.buys--;
        const card = await CardRegistry.getInstance().getCard(cardName).onBuy(this);
        if (card?.isCard) {
            this.boughtCards.push(card);
        }
        if (cardName === 'province' || cardName === 'colony') {
            await this.game.alertPlayersToProvinceOrColony(cardName);
        }
    }
    gainedCards: Card[] = [];
    async gain(cardName: string, realCard?: Card, log = true, destination: "discard" | "hand" | "deck" = 'discard'): Promise<Card | null> {
        const c = realCard ? realCard : this.game.grabNameFromSupply(cardName);
        if (c) {
            this.gainedCards.push(c);
            if (log) {
                this.lm('%p gains %s.', Util.formatCardList([c.name]));
            }
            const tracker = new Tracker(c);
            switch (destination) {
                case 'discard':
                    // Per http://wiki.dominionstrategy.com/index.php/Discard, you do not discard a card when you gain it.
                    await this.deck.discardCard(c);
                    tracker.onExercise(() => {
                        this.deck.discard.splice(this.deck.discard.indexOf(c), 1);
                    });
                    break;
                case 'hand':
                    this.data.hand.push(c);
                    tracker.onExercise(() => {
                        this.data.hand.splice(this.data.hand.indexOf(c), 1);
                    });
                    break;
                case 'deck':
                    this.deck.cards.unshift(c);
                    tracker.canExercise(() => {
                        return this.deck.cards[0] === c;
                    });
                    tracker.onExercise(() => {
                        this.deck.cards.shift();
                    });
                    break;
            }
            await this.events.emit('gain', tracker);
            await this.game.events.emit('gain', this, tracker);
            await this.effects.doEffect('gain', Texts.chooseAnXEffectToRunNext('on gain'), [
                {
                    name: c.name,
                    config: {
                        compatibility: {},
                        relevant: () => !isOriginal(c.onGainSelf)
                    },
                    effect: async () => c.onGainSelf(this, tracker),
                    effectName: 'gain',
                    id: v4()
                }
            ], tracker);
            return c;
        }
        return null;
    }
    async discard(card: Card | Card[], log = false, runHooks = true) {
        if (log && (!Array.isArray(card) || card.length > 0)) {
            this.lm('%p discards %s.', Util.formatCardList((Array.isArray(card) ? card : [card]).map((a) => a.name)));
        }
        if (Array.isArray(card)) {
            for (const c of card) {
                this.deck.discard.push(c);
                if (runHooks) {
                    const tracker = new Tracker(c);
                    tracker.onExercise(() => {
                        this.deck.discard.pop();
                    });
                    tracker.canExercise(() => this.deck.discard[this.deck.discard.length - 1].id === c.id);
                    await this.effects.doEffect('discard', Texts.chooseAnXEffectToRunNext('on discard'), [], tracker);
                }
            }
        }
        else {
            await this.discard([card], false, runHooks);
        }
    }
    score() {
        const score: {[cardName: string]: number} = {
            'VP Tokens': this.data.vp
        };
        this.game.selectedCards.forEach((cardName) => {
            score[cardName.split(" ").map((a) => a.slice(0,1).toUpperCase() + a.slice(1)).join(" ")] = CardRegistry.getInstance().getCard(cardName).onScore(this);
        });
        return score;
    }
    async chooseCard(helperText: string, source: Card[], optional = false, filter?: (card: Card) => boolean, sourceIsHand?: boolean, waysAvailable?: boolean): Promise<Card | null> {
        const optionalSource: Card[] = optional ? [{name: 'No Card', id: 'nocard'}] as Card[] : [];
        let result;
        let foundCard;
        if ((filter && source.filter(filter).length === 0) || source.length === 0) {
            return null;
        }
        if (((filter && source.filter(filter).length === 1) || source.length === 1) && !optional) {
            return filter ? source.filter(filter)[0] : source[0];
        }
        while((result = await this.makeDecision({
            decision: 'chooseCard',
            source: [...source, ...optionalSource],
            id: v4(),
            helperText,
            sourceIsHand,
            waysAvailable,
            validChoices: [...source.filter((a) => filter ? filter(a) : true), ...optionalSource]
        })) != null && ((foundCard = source.find((a) => a.id === result.id && a.name === result.name)) != null) && (filter && !filter(foundCard))) {
            console.log("Failed tests");
        }
        if (result.name === "No Card") {
            return null;
        }
        return foundCard;
    }
    async chooseCardFromHand(helperText: string, optional = false, filter?: (card: Card) => boolean, waysAvailable?: boolean): Promise<Card | null> {
        const foundCard = await this.chooseCard(helperText, this.data.hand, optional, filter, true, waysAvailable);
        if (foundCard == null) {
            return null;
        }
        const handIndex = this.data.hand.findIndex((a) => a.id === foundCard.id);
        if (handIndex === -1) {
            return null;
        }
        return this.data.hand.splice(handIndex, 1)[0] || null;
    }
    async confirmAction(helperText: string): Promise<boolean> {
        return this.makeDecision({
            decision: 'confirm',
            id: v4(),
            helperText
        });
    }
    async affectOthers(cb: (player: Player) => Promise<any>) {
        const currentPlayerIndex = this.game.players.indexOf(this);
        const affected = this.game.players.slice(currentPlayerIndex + 1, this.game.players.length).concat(this.game.players.slice(0, currentPlayerIndex));
        await Promise.all(affected.map((a) => cb(a)));
    }
    async affectOthersInOrder(cb: (player: Player) => Promise<any>) {
        const currentPlayerIndex = this.game.players.indexOf(this);
        const players = this.game.players.slice(currentPlayerIndex + 1, this.game.players.length).concat(this.game.players.slice(0, currentPlayerIndex));
        for (const player of players) {
            await cb(player);
        }
    }
    async attackOthers(exemptPlayers: Player[], cb: (player: Player) => Promise<any>) {
        const currentPlayerIndex = this.game.players.indexOf(this);
        let attacked = this.game.players.slice(currentPlayerIndex + 1, this.game.players.length).concat(this.game.players.slice(0, currentPlayerIndex));
        attacked = attacked.filter((a) => !exemptPlayers.includes(a));
        await Promise.all(attacked.map((a) => cb(a)));
    }
    async attackOthersInOrder(exemptPlayers: Player[], cb: (player: Player) => Promise<any>) {
        let currentPlayerIndex = this.game.players.indexOf(this) + 1;
        currentPlayerIndex %= this.game.players.length;
        let currentPlayer: Player;
        while ((currentPlayer = this.game.players[currentPlayerIndex]) != this) {
            if (exemptPlayers.indexOf(currentPlayer) === -1) {
                await cb(currentPlayer);
            }
            currentPlayerIndex++;
            currentPlayerIndex %= this.game.players.length;
        }
    }
    async attackOthersInSteps<T>(exemptPlayers: Player[], steps: readonly [(player: Player) => Promise<T>, (player: Player, result: T) => Promise<any>]): Promise<void> {
        const currentPlayerIndex = this.game.players.indexOf(this);
        let attacked = this.game.players.slice(currentPlayerIndex + 1, this.game.players.length).concat(this.game.players.slice(0, currentPlayerIndex));
        attacked = attacked.filter((a) => !exemptPlayers.includes(a));
        const fastStep = attacked.map((a) => steps[0](a));
        if (fastStep.length === 0) {
            return Promise.resolve();
        }
        async function cbNext(index, result) {
            await steps[1](attacked[index], result);
            if (index + 1 === fastStep.length) {
                return;
            }
            return fastStep[index + 1].then(cbNext.bind(null, index + 1));
        }
        return fastStep[0].then(cbNext.bind(null, 0));
    }
    trashedCards: Card[] = [];
    async trash(card: Card, log = true) {
        if (log) this.lm('%p trashes %s.', Util.formatCardList([card.name]));
        this.trashedCards.push(card);
        this.game.trash.push(card);
        const tracker = new Tracker(card);
        tracker.onExercise(() => {
            this.game.trash.splice(this.game.trash.indexOf(card), 1);
        });
        await card.onTrashSelf(this, tracker);
        await this.events.emit('trash', tracker);
        await this.game.events.emit('trash', this, tracker);
        await this.effects.doEffect('trash', Texts.chooseAnXEffectToRunNext('on trash'), [], tracker);
    }
    async chooseOption<T extends readonly string[]>(helperText: string, options: T): Promise<T[number]> {
        const {choice} = await this.makeDecision({
            decision: "chooseOption",
            id: v4(),
            options: options as any as string[],
            helperText
        });
        return choice;
    }
    async chooseOrder(helperText: string, cards: Card[], topText: string, bottomText: string): Promise<Card[]> {
        if (cards.length < 2 || Util.deduplicateByName(cards).length < 2) {
            return cards;
        }
        const {order} = await this.makeDecision({
            decision: 'reorder',
            id: v4(),
            helperText,
            bottomString: bottomText,
            topString: topText,
            cards
        });
        return order.map((a) => cards.find((b) => b.id === a.id)).filter((a) => a) as Card[];
    }
    async chooseGain(helperText: string, optional: boolean, gainRestrictions: GainRestrictions, destination: 'discard' | 'hand' | 'deck' | 'none' = 'discard'): Promise<Card | null> {
        const cardToGain = await this.makeDecision({
            decision: 'gain',
            helperText,
            id: v4(),
            gainRestrictions: gainRestrictions.build(this.game),
            optional
        });
        if (cardToGain.name === 'Gain Nothing') {
            return null;
        }
        if (destination === 'none') {
            return this.game.findCard(cardToGain.id, 'supply', true);
        }
        const gained = await this.gain(cardToGain.name, undefined, false, destination);
        if (gained != null) {
            this.lm('%p gains %s.', Util.formatCardList([gained.name]));
            return gained;
        }
        else {
            return null;
        }
    }
    async chooseCardFromDiscard(helperText: string, optional: boolean, filter?: (card: Card) => boolean): Promise<Card | null> {
        const optionalSource: Card[] = optional ? [{name: 'No Card', id: 'nocard'}] as Card[] : [];
        let result;
        let foundCard;
        if (filter && this.deck.discard.filter(filter).length === 0) {
            // No choices, return
            return null;
        }
        if (this.deck.discard.length === 0) {
            return null;
        }
        const discardNames = this.deck.discard.map((a) => a.name);
        const chooseFrom = this.deck.discard.filter((a, i) => discardNames.indexOf(a.name) === i);
        while ((result = await this.makeDecision({
            decision: 'chooseCard',
            source: [...chooseFrom, ...optionalSource],
            id: v4(),
            helperText,
            validChoices: [...this.deck.discard.filter((a) => filter ? filter(a) : true), ...optionalSource]
        })) != null && ((foundCard = this.deck.discard.find((a) => a.id === result.id && a.name == result.name)) != null) && (filter && !filter(foundCard))) {
            console.log("Filter unsatisfied");
        }
        if (result.name === "No Card") {
            // Make it very simple to have an out
            return null;
        }
        const discardIndex = this.deck.discard.findIndex((a) => a.id === result.id);
        if (discardIndex !== -1) {
            return this.deck.discard.splice(discardIndex, 1)[0];
        }
        return null;
    }
    async revealTop(cards: number, log = false): Promise<Array<Tracker<Card>>> {
        const cardsArr: Card[] = [];
        for (let i = 0; i < cards; i++) {
            const card = await this.deck.pop();
            if (card) {
                cardsArr.push(card);
            }
        }
        if (log) {
            this.lm('%p reveals %s.', Util.formatCardList(cardsArr.map((a) => a.name)));
        }
        const cardTrackers = cardsArr.map((card) => new Tracker(card));
        for (const card of cardTrackers) {
            await card.viewCard().onRevealSelf(this, card);
        }
        return cardTrackers;
    }
    async revealWithTracker(cards: Card[]): Promise<Array<Tracker<Card>>> {
        const cardTrackers = cards.map((a) => new Tracker(a));
        for (const tracker of cardTrackers) {
            await tracker.viewCard().onRevealSelf(this, tracker);
        }
        return cardTrackers;
    }
    async revealHand() {
        const cardTrackers = this.data.hand.map((a) => {
            const c = new Tracker(a);
            c.onExercise(() => {
                this.data.hand.splice(this.data.hand.findIndex((b) => b.id === a.id), 1);
            });
            return c;
        });
        for (const tracker of cardTrackers) {
            await tracker.viewCard().onRevealSelf(this, tracker);
        }
    }
    async reveal(cards: Card[]): Promise<Card[]> {
        const keptCards = [] as Card[];
        for (const card of cards) {
            const tracker = new Tracker(card);
            await card.onRevealSelf(this, tracker);
            if (tracker.hasTrack) {
                keptCards.push(card);
            }
        }
        return keptCards;
    }
    getTrackerInPlay<T extends Card>(card: T): Tracker<T> {
        if (!this.data.playArea.includes(card)) {
            throw new Error("Attempted to get a tracker for a card not in play!");
        }
        const t = new Tracker(card);
        t.onExercise(() => {
            if (!this.data.playArea.includes(card)) {
                throw new Error("Attempted to exercise a tracker after the card was already gone!");
            }
            this.data.playArea.splice(this.data.playArea.indexOf(card), 1);
        });
        return t;
    }
}