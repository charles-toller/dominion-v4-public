import Card from "../Card";
import Player from "../../server/Player";

export default class RuinedVillage extends Card {
    intrinsicTypes = ["action","ruins"] as const;
    name = "ruined village";
    cost = {
        coin: 0
    };
    cardText = "+1 Action";
    supplyCount = 10;
    cardArt = "/img/card-img/Ruined_VillageArt.jpg";
    randomizable = false;
    async onAction(player: Player): Promise<void> {
        player.data.actions++;
    }
    public static createSupplyPiles(): Array<{identifier: string; pile: Card[]; identity: Card; displayCount: boolean; hideCost?: boolean}> {
        return [];
    }
}