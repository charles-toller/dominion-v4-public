import Card from "../Card";
import type Game from "../../server/Game";
import {Texts} from "../../server/Texts";

export default class Hovel extends Card {
    static typelineSize = 62;
    intrinsicTypes = ["reaction","shelter"] as const;
    name = "hovel";
    intrinsicCost = {
        coin: 1
    };
    cardText = "When you buy a Victory card, you may trash this from your hand.";
    supplyCount = 0;
    cardArt = "/img/card-img/HovelArt.jpg";
    randomizable = false;
    getPileIdentifier(): string {
        return 'SPECIAL_NO_PILE';
    }
    public static createSupplyPiles(): Array<{identifier: string; pile: Card[]; identity: Card; displayCount: boolean; hideCost?: boolean}> {
        return [];
    }
    public static setup(globalCardData: any, game: Game) {
        game.players.forEach((player) => {
            player.effects.setupEffect('buy', 'hovel', {
                compatibility: {},
                relevant: (ctx, cardName) => game.getCard(cardName).types.includes("victory") && player.data.hand.some((a) => a.name === 'hovel')
            }, async (remove, card) => {
                if (game.getCard(card).types.includes("victory")
                    && player.data.hand.some((a) => a.name === 'hovel')
                    && await player.confirmAction(Texts.doYouWantToTrashA('hovel'))) {
                    const card = player.data.hand.splice(player.data.hand.findIndex((a) => a.name === 'hovel'), 1)[0];
                    await player.trash(card);
                }
            });
        });
    }
}
