import Card from "../Card";
import type Player from "../../server/Player";
import {Texts} from "../../server/Texts";
import {GainRestrictions} from "../../server/GainRestrictions";
import Cost from "../../server/Cost";

export default class Groom extends Card {
    intrinsicTypes = ["action"] as const;
    name = "groom";
    intrinsicCost = {
        coin: 4
    };
    cardText = "Gain a card costing up to $4. If it's an...\n" +
        "Action card, gain a Horse;\n" +
        "Treasure card, gain a Silver;\n" +
        "Victory card, +1 Card and +1 Action.";
    supplyCount = 10;
    cardArt = "/img/card-img/GroomArt.jpg";
    public static onChosen() {
        return ['horse'];
    }
    async onPlay(player: Player): Promise<void> {
        const card = await player.chooseGain(Texts.chooseCardToGainFor('groom'), false, GainRestrictions.instance().setUpToCost(Cost.create(4)));
        if (!card) return;
        if (card.types.includes("action")) {
            await player.gain('horse');
        }
        if (card.types.includes("treasure")) {
            await player.gain('silver');
        }
        if (card.types.includes("victory")) {
            await player.draw(1, true);
            player.data.actions++;
        }
    }
}
