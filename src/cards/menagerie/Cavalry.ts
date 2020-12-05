import Card from "../Card";
import type Player from "../../server/Player";

export default class Cavalry extends Card {
    intrinsicTypes = ["action"] as const;
    name = "cavalry";
    intrinsicCost = {
        coin: 4
    };
    cardText = "Gain 2 Horses.\n" +
        "---\n" +
        "When you gain this, +2 Cards, +1 Buy, and if it's your Buy phase return to your Action phase.";
    supplyCount = 10;
    cardArt = "/img/card-img/CavalryArt.jpg";
    public static onChosen() {
        return ['horse'];
    }
    async onPlay(player: Player): Promise<void> {
        await player.gain('horse');
        await player.gain('horse');
    }
    async onGainSelf(player: Player): Promise<void> {
        await player.draw(2, true);
        player.data.buys++;
        player.returnToPhase("action");
    }
}
