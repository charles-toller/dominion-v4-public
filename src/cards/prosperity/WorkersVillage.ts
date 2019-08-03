import Card from "../Card";
import Player from "../../server/Player";

export default class WorkersVillage extends Card {
    types = ["action"] as const;
    name = "worker's village";
    cost = {
        coin: 4
    };
    cardText = "+1 Card\n" +
        "+2 Actions\n" +
        "+1 Buy";
    supplyCount = 10;
    cardArt = "/img/card-img/Workers_VillageArt.jpg";
    async onAction(player: Player): Promise<void> {
        player.draw();
        player.data.actions += 2;
        player.data.buys += 1;
    }
}