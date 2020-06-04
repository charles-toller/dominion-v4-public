import Card from "../Card";
import type Player from "../../server/Player";

export default class Stockpile extends Card {
    intrinsicTypes = ["treasure"] as const;
    name = "stockpile";
    intrinsicCost = {
        coin: 3
    };
    cardText = "$3\n" +
        "+1 Buy\n" +
        "When you play this, Exile it.";
    supplyCount = 10;
    cardArt = "/img/card-img/StockpileArt.jpg";
    async onPlay(player: Player, ep, tracker): Promise<void> {
        await player.addMoney(3);
        player.data.buys++;
        if (tracker.hasTrack) {
            player.data.exile.push(tracker.exercise()!);
        }
    }
}
