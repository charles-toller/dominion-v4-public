import Card from "../Card";
import Player from "../../server/Player";
import {Texts} from "../../server/Texts";

export default class Bishop extends Card {
    types = ["action"] as const;
    name = "bishop";
    features = ["vp"] as const;
    cost = {
        coin: 4
    };
    cardText = "+$1\n" +
        "+1 VP\n" +
        "Trash a card from your hand.+1 VP per $2 it costs (round down). Each other player may trash a card from their hand.";
    supplyCount = 10;
    cardArt = "/img/card-img/BishopArt.jpg";
    async onAction(player: Player): Promise<void> {
        player.data.money += 2;
        player.data.vp += 1;
        const card = await player.chooseCardFromHand(Texts.chooseCardToTrashFor('bishop'));
        if (card) {
            await player.trash(card);
            player.data.vp += Math.floor(player.game.getCostOfCard(card.name).coin / 2);
        }
        await player.affectOthersInOrder(async (p) => {
            const card = await p.chooseCardFromHand(Texts.chooseCardToTrashFor('bishop'), true);
            if (card) {
                await p.trash(card);
            }
        });
    }
}