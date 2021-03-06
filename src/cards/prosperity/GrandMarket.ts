import Card from "../Card";
import type Player from "../../server/Player";
import type {GainRestrictions} from "../../server/GainRestrictions";

export default class GrandMarket extends Card {
    static descriptionSize = 54;
    intrinsicTypes = ["action"] as const;
    name = "grand market";
    intrinsicCost = {
        coin: 6
    };
    cardText = "+1 Card\n" +
        "+1 Action\n" +
        "+1 Buy\n" +
        "+$2\n" +
        "---\n" +
        "You can’t buy this if you have any Coppers in play.";
    supplyCount = 10;
    cardArt = "/img/card-img/Grand_MarketArt.jpg";
    async onPlay(player: Player): Promise<void> {
        await player.draw(1, true);
        player.data.actions++;
        player.data.buys++;
        await player.addMoney(2);
    }
    public static getExtraRestrictions(cardData: any, player: Player, restrictions: GainRestrictions): GainRestrictions {
        if (player.data.playArea.find((a) => a.name === 'copper') != null) {
            restrictions.addBannedCard('grand market');
        }
        return restrictions;
    }
}
