import Card from "../Card";
import Player from "../../server/Player";
import {Texts} from "../../server/Texts";
import {GainRestrictions} from "../../server/GainRestrictions";

export default class Feast extends Card {
    intrinsicTypes = ["action"] as const;
    name = "feast";
    intrinsicCost = {
        coin: 4
    };
    cardText = "Trash this card.\n" +
        "Gain a card costing up to $5.";
    supplyCount = 10;
    cardArt = "/img/card-img/FeastArt.jpg";
    async onAction(player: Player, exemptPlayers, tracker): Promise<void> {
        if (tracker.hasTrack) {
            await player.trash(tracker.exercise()!);
        }
        await player.chooseGain(Texts.chooseCardToGainFor('feast'), false, GainRestrictions.instance().setMaxCoinCost(5));
    }
}
