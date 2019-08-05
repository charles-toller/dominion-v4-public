import Card from "../Card";
import Player from "../../server/Player";
import {Texts} from "../../server/Texts";
import {GainRestrictions} from "../../server/GainRestrictions";

export default class Expand extends Card {
    types = ["action"] as const;
    name = "expand";
    cost = {
        coin: 7
    };
    cardText = "Trash a card from your hand. Gain a card costing up to $3 more than it.";
    supplyCount = 10;
    cardArt = "/img/card-img/ExpandArt.jpg";
    async onAction(player: Player): Promise<void> {
        const card = await player.chooseCardFromHand(Texts.chooseCardToTrashFor('expand'));
        if (card) {
            await player.trash(card);
            await player.chooseGain(Texts.chooseCardToGainFor('expand'), false, GainRestrictions.instance().setMaxCoinCost(player.game.getCostOfCard(card.name).coin + 3));
        }
    }
}