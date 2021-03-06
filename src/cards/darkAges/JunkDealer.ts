import Card from "../Card";
import type Player from "../../server/Player";
import {Texts} from "../../server/Texts";

export default class JunkDealer extends Card {
    intrinsicTypes = ["action"] as const;
    name = "junk dealer";
    intrinsicCost = {
        coin: 5
    };
    cardText = "+1 Card\n" +
        "+1 Action\n" +
        "+$1\n" +
        "Trash a card from your hand.";
    supplyCount = 10;
    cardArt = "/img/card-img/800px-Junk_DealerArt.jpg";
    async onPlay(player: Player): Promise<void> {
        await player.draw(1, true);
        player.data.actions += 1;
        await player.addMoney(1);
        const card = await player.chooseCardFromHand(Texts.chooseCardToTrashFor('junk dealer'));
        if (card) {
            await player.trash(card, true);
        }
    }
}
