import Card from "../Card";
import type Player from "../../server/Player";

export default class City extends Card {
    intrinsicTypes = ["action"] as const;
    name = "city";
    intrinsicCost = {
        coin: 5
    };
    cardText = "+1 Card\n" +
        "+2 Actions\n" +
        "If there are one or more empty Supply piles, +1 Card. If there are two or more, +1 Buy and +$1.";
    supplyCount = 10;
    cardArt = "/img/card-img/CityArt.jpg";
    async onPlay(player: Player): Promise<void> {
        await player.draw(player.game.supply.pilesEmpty > 0 ? 2 : 1, true);
        player.data.actions += 2;
        if (player.game.supply.pilesEmpty > 1) {
            player.data.buys += 1;
            await player.addMoney(1);
        }
    }
}
