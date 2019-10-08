import Player from "./Player";
import {Decision, DecisionDefaults, DecisionResponseType} from "./Decision";
import {Texts} from "./Texts";
import Card from "../cards/Card";
import Util from "../Util";
import nlp = require('compromise');

type PossibleAsync<T> = T | Promise<T>;

function assertNever(a: never) {
    throw a;
}

const normalizeParams = {
    whitespace: false,
    case: false,
    numbers: false,
    punctuation: false,
    unicode: false,
    contractions: false,
    acronyms: false,
    plurals: true
};
type Matcher = {
    regex: RegExp;
    mappings: Array<{
        type: 'pure' | 'unnumeral';
        index: number;
    }>;
}
type ArgTuple<T> = T extends (...args: infer R) => string ? R : never;
const offset = 5;
const decisionMatcherCache = new Map<(...args: any[]) => string, Matcher>();

/**
 * This function generates a RegEx for a given string-generating function, caches it with the function, and then returns what arguments were passed to the function to make the given helperText (or null if it's not a match).
 * @param helperText
 * @param textFn
 */
function decisionMatcher<T extends (...args: any[]) => string>(helperText: string, textFn: T): ArgTuple<T> | null {
    let matcher: Matcher;
    if (!decisionMatcherCache.has(textFn)) {
        let partsWithOne = textFn(...new Array(textFn.length).fill(1)).split(/(\b(?:1|one)\b)/);
        const partsWithTwo = textFn(...new Array(textFn.length).fill(2)).split(/(\b(?:2|two)\b)/);
        if (partsWithOne.length !== partsWithTwo.length) {
            let oneIndex = 0;
            let twoIndex = 0;
            let tempOne = [] as string[];
            while (oneIndex < partsWithOne.length) {
                const twoPart = nlp(partsWithTwo[twoIndex]).normalize(normalizeParams).out('text');
                if (partsWithOne[oneIndex].length !== twoPart.length) {
                    let sep = new RegExp("(" + twoPart + ")");
                    let parts = partsWithOne[oneIndex].split(sep);
                    if (parts[0] === '') {
                        // We matched the front, push onto temp and move to second half
                        tempOne.push(parts[1]);
                        partsWithOne.splice(oneIndex, 1, ...parts.slice(2));
                    } else {
                        // We matched the back, push onto temp completely and move on
                        tempOne.push(...parts.slice(0, -1), partsWithOne[oneIndex + 1]);
                        oneIndex += 2;
                    }
                    twoIndex += 2;
                } else {
                    tempOne.push(partsWithOne[oneIndex], partsWithOne[oneIndex + 1]);
                    oneIndex += 2;
                    twoIndex += 2;
                }
            }
            if (tempOne.length === partsWithTwo.length + 1) {
                // We may get an extra piece at the end due to skips. Eliminate it if needed.
                tempOne = tempOne.slice(0, -1);
            }
            partsWithOne = tempOne;
        }
        let regBuilder = '';
        partsWithOne.map((a, i) => {
            if (i % 2 === 1) {
                // Return a universal matcher
                regBuilder += '(.*?)';
                return;
            }
            let onePart = a;
            let twoPart = partsWithTwo[i];
            let oneIndex = 0;
            twoPart.split('').forEach((a) => {
                if (a === onePart[oneIndex]) {
                    regBuilder += a.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
                    oneIndex++;
                } else {
                    regBuilder += a.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + "?";
                }
            });
            console.log(textFn);
            console.log(Texts);
        });
        let regex = new RegExp(regBuilder);
        let nums = new Array(textFn.length).fill(null).map((a, i) => i + offset);
        const callWithMaps = textFn(...nums);
        let mappings = Array.prototype.slice.call(regex.exec(callWithMaps), 1).map((a) => {
            if (/^\d+$/.test(a)) {
                // Just a pure number
                return {
                    type: 'pure' as 'pure',
                    index: parseInt(a) - offset
                };
            } else {
                return {
                    type: 'unnumeral' as 'unnumeral',
                    index: Util.unnumeral(a) - offset
                };
            }
        });
        matcher = {
            regex,
            mappings
        };
        decisionMatcherCache.set(textFn, matcher);
    }
    else {
        matcher = decisionMatcherCache.get(textFn)!;
    }
    let subs = [] as Array<string | number>;
    let exec = matcher.regex.exec(helperText);
    if (exec == null) {
        return null;
    }
    Array.prototype.slice.call(matcher.regex.exec(helperText), 1).forEach((match: string, i) => {
        subs[matcher.mappings[i].index] = matcher.mappings[i].type === 'unnumeral' ? Util.unnumeral(match) : match;
    });
    return subs as any;
}

export default abstract class AIPlayer extends Player {
    private hasPlayedAllTreasures = false;
    private choiceLookup = {
        [Texts.trashIt]: this.trashPriority,
        [Texts.discardIt]: this.discardPriority,
        [Texts.putThemOnYourDeck]: this.topDeckPriority,
        [Texts.discardThem]: this.discardPriority
    };
    // Least to most destructive
    protected destructiveness = [
        Texts.keepIt,
        Texts.discardIt,
        Texts.putItOnYourDeck,
        Texts.trashIt
    ];
    private async chooseOptionFromPriorities(card: string, choices: string[]): Promise<string> {
        for (let choice of choices) {
            if (this.choiceLookup[choice]) {
                const priority = await this.choiceLookup[choice].call(this);
                let nullIndex = priority.indexOf(null);
                if (nullIndex === -1) {
                    nullIndex = priority.length;
                }
                if (priority.includes(card) && priority.indexOf(card) < nullIndex) {
                    return choice;
                }
            }
        }
        return choices.sort((a, b) => this.destructiveness.indexOf(a) - this.destructiveness.indexOf(b))[0];
    }
    private chooseCardFromPriority(priority: Array<string | null>, source: Card[]): Card {
        const choice = priority.map((a) => {
            if (a == null) {
                return source.find((a) => a.name === 'No Card');
            }
            return source.find((b) => b.name === a);
        }).find((a) => a !== undefined);
        if (choice != null) {
            return choice as any;
        }
        let noChoice = source.find((a) => a.name === 'No Card');
        if (noChoice) {
            return noChoice as any;
        }
        // We have to return something
        return source[0] as any;
    }
    private wantCardOverNothing(priority: Array<string | null>, card: string): boolean {
        return this.chooseCardFromPriority(priority, [{id: 'yes', name: card}, {id: '', name: 'No Card'}] as any).name !== 'No Card';
    }
    protected decisionContext: Decision = null as any;
    async makeDecision<T extends Decision>(de: T): Promise<DecisionResponseType[T["decision"]]> {
        const decision: Decision = de;
        this.decisionContext = de;
        const d = DecisionDefaults[decision.decision](decision);
        if (d != null) {
            return d as any;
        }
        switch (decision.decision) {
            case "chooseCardOrBuy":
                if (!this.hasPlayedAllTreasures) {
                    const toPlay = await this.playNextTreasure(decision.source);
                    if (toPlay) {
                        return {
                            choice: decision.source.find((a) => a.name === toPlay),
                            responseType: 'playCard'
                        } as any;
                    }
                    else {
                        this.hasPlayedAllTreasures = true;
                    }
                }
            case "buy":
                const toBuy = (await this.gainPriority()).find((a) => a == null || decision.gainRestrictions.allowedCards.includes(a));
                if (toBuy) {
                    const pile = this.game.supply.data.piles.find((a) => a.pile.length && a.pile[a.pile.length - 1].name === toBuy)!.pile;
                    return {
                        choice: pile[pile.length - 1],
                        responseType: 'buy'
                    } as any;
                }
                else {
                    return {
                        responseType: 'buy',
                        choice: {
                            name: 'End Turn',
                            id: ''
                        }
                    } as any;
                }
            case "chooseOption":
                const chooseWhatToDoWithCard = decisionMatcher(decision.helperText, Texts.whatToDoWith);
                if (chooseWhatToDoWithCard) {
                    const [card] = chooseWhatToDoWithCard;
                    return {
                        choice: await this.chooseOptionFromPriorities(card, decision.options)
                    } as any;
                }
                const artifact = decisionMatcher(decision.helperText, () => Texts.whichArtifactWouldYouLike);
                if (artifact) {
                    return {
                        choice: decision.options[0]
                    } as any;
                }
                const chooseBenefit = decisionMatcher(decision.helperText, Texts.chooseBenefitFor);
                if (chooseBenefit) {
                    return {
                        choice: decision.options[0]
                    } as any;
                }
                const chooseWhatToDoWithCards = decisionMatcher(decision.helperText, Texts.whatToDoWithCards);
                if (chooseWhatToDoWithCards) {
                    const [cards] = chooseWhatToDoWithCards;
                    const cardList = Util.parseCardList(cards);
                    return {
                        choice: await this.chooseOptionFromPriorities(cardList[0], decision.options)
                    } as any;
                }
                break;
            case "chooseCard":
                const keys = {
                    duplication: decisionMatcher(decision.helperText, Texts.chooseAToDuplicateWithB),
                    banCard: decisionMatcher(decision.helperText, Texts.chooseACardThatACannotBuyThisTurn),
                    chooseTreasureToTrash: decisionMatcher(decision.helperText, Texts.chooseATreasureToTrashFor),
                    chooseAToTrashForB: decisionMatcher(decision.helperText, Texts.chooseAnAToTrashForB),
                    victoryTopdeck: decisionMatcher(decision.helperText, Texts.chooseVictoryToTopDeckFor),
                    regularTopdeck: decisionMatcher(decision.helperText, () => Texts.chooseCardToPutOnDeck),
                    discardTopDeck: decisionMatcher(decision.helperText, Texts.chooseCardToMoveFromDiscardToDeck),
                    discardCard: decisionMatcher(decision.helperText, Texts.chooseCardToDiscardFor),
                    discardCardForBenefit: decisionMatcher(decision.helperText, Texts.discardForBenefit),
                    discardTypeForBenefit: decisionMatcher(decision.helperText, Texts.discardAForBenefit),
                    trashCard: decisionMatcher(decision.helperText, Texts.chooseCardToTrashFor),
                    playAction: decisionMatcher(decision.helperText, () => Texts.chooseActionToPlay),
                    actionCardPlayTwice: decisionMatcher(decision.helperText, () => Texts.chooseCardToPlayTwice),
                    actionCardReplay: decisionMatcher(decision.helperText, () => Texts.chooseCardToReplay),
                    cardsToGainFromTrashed: decisionMatcher(decision.helperText, () => Texts.chooseCardToGainFromTrashed),
                    cardFromDiscard: decisionMatcher(decision.helperText, () => Texts.chooseCardToTakeFromDiscard),
                    forgeTrash: decisionMatcher(decision.helperText, Texts.chooseCardToTrashForge),
                    drawFromRevealed: decisionMatcher(decision.helperText, () => Texts.chooseCardToTakeFromRevealed),
                    takeFromAside: decisionMatcher(decision.helperText, () => Texts.chooseCardToTakeFromSetAside),
                };
                if (keys.discardCard != null) {
                    return this.chooseCardFromPriority(await this.discardPriority(), decision.validChoices) as any;
                }
                if (keys.discardCardForBenefit) {
                    const choice = await this.discardForBenefit(decision.validChoices.map((a) => a.name), keys.discardCardForBenefit[1], keys.discardCardForBenefit[0]);
                    return decision.validChoices.find((a) => a.name === choice) as any;
                }
                if (keys.discardTypeForBenefit) {
                    const choice = await this.discardForBenefit(decision.validChoices.map((a) => a.name), keys.discardTypeForBenefit[1], keys.discardTypeForBenefit[2]) as any;
                    return decision.validChoices.find((a) => a.name === choice) as any;
                }
                if (keys.trashCard != null) {
                    return this.chooseCardFromPriority(await this.trashPriority(), decision.validChoices) as any;
                }
                if (keys.discardTopDeck) {
                    return this.chooseCardFromPriority(await this.topDeckPriority(), decision.validChoices) as any;
                }
                if (keys.victoryTopdeck) {
                    return this.chooseCardFromPriority((await this.topDeckPriority()).reverse(), decision.validChoices) as any;
                }
                if (keys.regularTopdeck) {
                    return this.chooseCardFromPriority((await this.topDeckPriority()), decision.validChoices) as any;
                }
                if (keys.chooseAToTrashForB) {
                    return this.chooseCardFromPriority((await this.trashPriority()).reverse(), decision.validChoices) as any;
                }
                if (keys.chooseTreasureToTrash) {
                    return this.chooseCardFromPriority((await this.trashPriority()).reverse(), decision.validChoices) as any;
                }
                if (keys.cardFromDiscard || keys.drawFromRevealed || keys.takeFromAside) {
                    return this.chooseCardFromPriority(await this.drawPriority(), decision.validChoices) as any;
                }
                if (keys.forgeTrash) {
                    return this.chooseCardFromPriority(await this.trashPriority(), decision.validChoices) as any;
                }
                if (keys.banCard) {
                    return {
                        name: 'gold',
                        id: ''
                    } as any;
                }
                if (keys.duplication || keys.cardsToGainFromTrashed) {
                    return this.chooseCardFromPriority(await this.gainPriority(), decision.validChoices) as any;
                }
                if (keys.playAction || keys.actionCardPlayTwice) {
                    const actionToPlay = this.playNextAction(decision.validChoices);
                    if (actionToPlay) {
                        const card = decision.validChoices.find((a) => a.name === actionToPlay);
                        if (card) {
                            return {
                                id: card.id,
                                name: card.name
                            } as any;
                        }
                    }
                    return decision.validChoices.find((a) => a.name === 'No Card') as any;
                }
                if (keys.actionCardReplay) {
                    return decision.validChoices[0] as any;
                }
                break;
            case "chooseUsername":
                return this.generateUsername() as any;
            case "confirm":
                const confirmKeys = {
                    wantTrash: decisionMatcher(decision.helperText, Texts.doYouWantToTrashA),
                    wantDeckToDiscard: decisionMatcher(decision.helperText, () => Texts.placeDeckIntoDiscard),
                    wantDraw: decisionMatcher(decision.helperText, Texts.wantToDraw),
                    wantRevealMoat: decisionMatcher(decision.helperText, () => Texts.doYouWantToReveal('moat')),
                    shouldADiscardBOnDeck: decisionMatcher(decision.helperText, Texts.shouldADiscardTheBOnTopOfTheirDeck),
                    wantToPlayFromDiscard: decisionMatcher(decision.helperText, Texts.playCardFromDiscard),
                    wantDiscardFor: decisionMatcher(decision.helperText, Texts.doYouWantToDiscardAnAForB),
                    wantOnDeck: decisionMatcher(decision.helperText, Texts.doYouWantToPutTheAOnYourDeck),
                    wantSetAside: decisionMatcher(decision.helperText, Texts.wouldYouLikeToSetAsideThe),
                    ensureTrash: decisionMatcher(decision.helperText, Texts.areYouSureYouWantToTrash),
                    wantBuyCoffers: decisionMatcher(decision.helperText, () => Texts.wantBuyCoffers),
                    discardForBenefit: decisionMatcher(decision.helperText, Texts.wantToDiscardAForBenefit)
                };
                if (confirmKeys.wantTrash) {
                    return this.wantCardOverNothing(await this.trashPriority(), confirmKeys.wantTrash[0]) as any;
                }
                if (confirmKeys.wantDeckToDiscard) {
                    return (await this.wantDeckToDiscard()) as any;
                }
                if (confirmKeys.wantDraw) {
                    return this.wantCardOverNothing(await this.drawPriority(), confirmKeys.wantDraw[0]) as any;
                }
                if (confirmKeys.wantRevealMoat) {
                    // TODO: Delegate with attack knowledge
                    return true as any;
                }
                if (confirmKeys.shouldADiscardBOnDeck) {
                    if (confirmKeys.shouldADiscardBOnDeck[0] === 'you') {
                        return this.wantCardOverNothing(await this.drawPriority(), confirmKeys.shouldADiscardBOnDeck[1]) as any;
                    }
                    else {
                        // Do I want to discard it? Then somebody else probably shouldn't.
                        return !this.wantCardOverNothing(await this.discardPriority(), confirmKeys.shouldADiscardBOnDeck[1]) as any;
                    }
                }
                if (confirmKeys.wantToPlayFromDiscard) {
                    // TODO: Delegate to a want play
                    return true as any;
                }
                if (confirmKeys.wantDiscardFor) {
                    return this.wantCardOverNothing(await this.discardPriority(), confirmKeys.wantDiscardFor[1]) as any;
                }
                if (confirmKeys.wantOnDeck) {
                    return this.wantCardOverNothing(await this.drawPriority(), confirmKeys.wantOnDeck[0]) as any;
                }
                if (confirmKeys.wantSetAside) {
                    // TODO: Delegate
                    return false as any;
                }
                if (confirmKeys.ensureTrash) {
                    return this.wantCardOverNothing(await this.trashPriority(), confirmKeys.ensureTrash[0]) as any;
                }
                if (confirmKeys.wantBuyCoffers) {
                    return true as any;
                }
                if (confirmKeys.discardForBenefit) {
                    return ((await this.discardForBenefit([confirmKeys.discardForBenefit[0]],1, confirmKeys.discardForBenefit[1])) !== 'No Card') as any;
                }
                break;
            case "gain":
                const choice = this.chooseCardFromPriority(await this.gainPriority(), [
                    decision.optional ? {name: 'No Card', id: ''} as any : null,
                    ...decision.gainRestrictions.allowedCards.map((a) => ({name: a, id: ''}))
                ].filter((a) => a));
                if (choice.name === 'No Card') {
                    return {
                        id: '',
                        name: 'Gain Nothing'
                    } as any;
                }
                let pile = this.game.supply.data.piles.find((a) => {
                    return a.pile.length > 0 && a.pile[a.pile.length - 1].name === choice.name;
                });
                if (!pile) {
                    throw new Error("Missing supply pile");
                }
                return {
                    name: choice.name,
                    id: pile.pile[pile.pile.length - 1].id
                } as any;
            case "reorder":
                return {order: decision.cards} as any;
            default:
                assertNever(decision);
                break;
        }
        throw new Error(`Could not respond to decision: ${JSON.stringify(decision)}`);
    }
    abstract gainPriority(): PossibleAsync<Array<string | null>>;
    abstract trashPriority(): PossibleAsync<Array<string | null>>;
    abstract drawPriority(): PossibleAsync<Array<string | null>>;
    abstract discardPriority(): PossibleAsync<Array<string | null>>;
    abstract topDeckPriority(): PossibleAsync<Array<string | null>>;
    abstract playNextTreasure(source: Card[]): PossibleAsync<string | null>;
    abstract playNextAction(source: Card[]): PossibleAsync<string | null>;
    abstract generateUsername(): PossibleAsync<string>;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected async discardForBenefit(choices: string[], number: number, benefit: string): Promise<string> {
        if (number === 1 && choices.length === 1 && choices[0] === 'market square') {
            return 'market square';
        }
        if (number < await this.willingToDiscard(choices.filter((a) => a !== 'No Card'))) {
            return this.chooseCardFromPriority(await this.discardPriority(), choices.map((a, i) => ({name: a, id: a + i})) as any).name;
        }
        return choices.find((a) => a === 'No Card') || choices[0];
    }
    protected async willingToDiscard(choices: string[]): Promise<number> {
        return (await Promise.all(choices.map(async (a) => this.wantCardOverNothing(await this.discardPriority(), a)))).filter((a) => a).length;
    }
    protected wantDeckToDiscard() {
        return false;
    }
    protected getTotalMoney() {
        return this.allCards.reduce((sum, next) => {
            switch (next.name) {
                case 'copper':
                    return sum + 1;
                case 'silver':
                    return sum + 2;
                case 'gold':
                    return sum + 3;
                case 'platinum':
                    return sum + 5;
                default:
                    return sum;
            }
        }, 0);
    }
    protected gainsToEndGame() {
        return this.game.supply.gainsToEndGame;
    }
}