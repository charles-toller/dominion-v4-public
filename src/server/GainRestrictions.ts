import type Game from "./Game";
import type Card from "../cards/Card";
import Cost, {CostResult} from "./Cost";

export type GainRestrictionsJSON = {
    allowedCards: string[];
}
export class GainRestrictions {
    upToCost: Cost | null = null;
    exactCost: Cost | null = null;
    lessThanCost: Cost | null = null;
    costRange: [Cost, Cost] | null = null;
    inSupply = true;
    allowedCards: string[] | null = null;
    mustHaveTypes: string[] = [];
    bannedTypes: string[] = [];
    banned: string[] = [];
    isCard = true;
    cardAvailable = true;
    private constructor() {

    }
    static fromJSON(json: GainRestrictionsJSON) {
        const i = new this();
        i.allowedCards = json.allowedCards;
        return i;
    }
    static instance() {
        return new this();
    }
    validateCard(card: string) {
        if (this.allowedCards == null) {
            throw new Error("Tried to validate card without prior build()");
        }
        return this.allowedCards.includes(card);
    }
    isCardAllowed(game: Game, card: string) {
        return (!this.cardAvailable || game.nameAvailable(card, this.inSupply))
            && this.mustHaveTypes.reduce((last, type) => last && game.getTypesOfCard(card).includes(type as any), true)
            && this.bannedTypes.reduce((last, type) => last && !game.getTypesOfCard(card).includes(type as any), true)
            && !this.banned.includes(card)
            && (this.exactCost == null || this.exactCost.compareTo(game.getCostOfCard(card)) === CostResult.EQUAL)
            && (this.upToCost == null || game.getCostOfCard(card).isInRange(null, this.upToCost))
            && (this.lessThanCost == null || game.getCostOfCard(card).compareTo(this.lessThanCost) === CostResult.LESS_THAN)
            && (this.costRange == null || game.getCostOfCard(card).isInRange(this.costRange[0], this.costRange[1]))
            && (!this.isCard || game.getCard(card).isCard);
    }
    toJSON(game: Game): GainRestrictionsJSON {
        this.allowedCards = [];
        game.supply.data.piles.forEach((pile) => {
            let card: Card;
            if (pile.pile.length === 0 && this.inSupply && this.cardAvailable) {
                return;
            }
            else if (pile.pile.length === 0) {
                card = pile.identity;
            }
            else {
                card = pile.pile[pile.pile.length - 1];
            }
            if (this.isCardAllowed(game, card.name)) {
                this.allowedCards!.push(card.name);
            }
        });
        return {
            allowedCards: this.allowedCards
        };
    }
    build(game: Game) {
        return this.toJSON(game);
    }
    setUpToCost(cost: Cost) {
        this.upToCost = cost;
        this.exactCost = null;
        this.lessThanCost = null;
        this.costRange = null;
        return this;
    }
    setExactCost(cost: Cost) {
        this.exactCost = cost;
        this.upToCost = null;
        this.lessThanCost = null;
        this.costRange = null;
        return this;
    }
    setLessThanCost(cost: Cost) {
        this.lessThanCost = cost;
        this.exactCost = null;
        this.upToCost = null;
        this.costRange = null;
        return this;
    }
    setCostRange(lowerCost: Cost, higherCost: Cost) {
        this.costRange = [lowerCost, higherCost];
        this.exactCost = null;
        this.upToCost = null;
        this.lessThanCost = null;
        return this;
    }
    setMustIncludeType(type: string) {
        this.mustHaveTypes.push(type);
        return this;
    }
    addBannedType(type: string) {
        this.bannedTypes.push(type);
        return this;
    }
    // noinspection JSUnusedGlobalSymbols
    setInSupply(inSupply: boolean) {
        this.inSupply = inSupply;
        return this;
    }
    addBannedCard(card: string) {
        this.banned.push(card);
        return this;
    }
    setIsCard(isCard: boolean) {
        this.isCard = isCard;
        return this;
    }
    setIsAvailable(available: boolean) {
        this.cardAvailable = available;
        return this;
    }
}