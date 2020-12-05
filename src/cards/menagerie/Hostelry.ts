import Card from "../Card";
import type Player from "../../server/Player";
import {Texts} from "../../server/Texts";

export default class Hostelry extends Card {
    intrinsicTypes = ["action"] as const;
    name = "hostelry";
    intrinsicCost = {
        coin: 4
    };
    cardText = "+1 Card\n" +
        "+2 Actions\n" +
        "---\n" +
        "When you gain this, you may discard any number of Treasures, revealed, to gain that many Horses.";
    supplyCount = 10;
    cardArt = "/img/card-img/HostelryArt.jpg";
    public static onChosen() {
        return ['horse'];
    }
    async onPlay(player: Player): Promise<void> {
        await player.draw(1, true);
        player.data.actions += 2;
    }
    async onGainSelf(player: Player): Promise<void> {
        while (player.data.hand.some((a) => a.types.includes("treasure"))) {
            const card = await player.chooseCardFromHand(Texts.discardAForBenefit('treasure', 1, 'gain a Horse'), true, (card) => card.types.includes("treasure"));
            if (!card) break;
            const toDiscard = await player.reveal([card]);
            if (toDiscard.length) {
                await player.discard(toDiscard);
            }
            await player.gain('horse');
        }
    }
}
