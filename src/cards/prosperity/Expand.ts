import Card from "../Card";
import type Player from "../../server/Player";
import {Texts} from "../../server/Texts";
import {GainRestrictions} from "../../server/GainRestrictions";
import Cost from "../../server/Cost";

export default class Expand extends Card {
    intrinsicTypes = ["action"] as const;
    name = "expand";
    intrinsicCost = {
        coin: 7
    };
    cardText = "Trash a card from your hand. Gain a card costing up to $3 more than it.";
    supplyCount = 10;
    cardArt = "/img/card-img/ExpandArt.jpg";
    async onPlay(player: Player): Promise<void> {
        const card = await player.chooseCardFromHand(Texts.chooseCardToTrashFor('expand'));
        if (card) {
            await player.trash(card);
            await player.chooseGain(Texts.chooseCardToGainFor('expand'), false, GainRestrictions.instance().setUpToCost(card.cost.augmentBy(Cost.create(3))));
        }
    }
}
