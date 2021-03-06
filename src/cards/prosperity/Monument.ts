import Card from "../Card";
import type Player from "../../server/Player";

export default class Monument extends Card {
    intrinsicTypes = ["action"] as const;
    name = "monument";
    features = ["vp"] as const;
    intrinsicCost = {
        coin: 4
    };
    cardText = "+$2\n" +
        "+1 VP";
    supplyCount = 10;
    cardArt = "/img/card-img/MonumentArt.jpg";
    async onPlay(player: Player): Promise<void> {
        await player.addMoney(2);
        player.data.vp += 1;
    }
}