import Card from "../Card";
import type Player from "../../server/Player";

export default class SnowyVillage extends Card {
    intrinsicTypes = ["action"] as const;
    name = "snowy village";
    intrinsicCost = {
        coin: 3
    };
    cardText = "+1 Card\n" +
        "+4 Actions\n" +
        "+1 Buy\n" +
        "Ignore any further +Actions you get this turn.";
    supplyCount = 10;
    cardArt = "/img/card-img/Snowy_VillageArt.jpg";
    async onPlay(player: Player): Promise<void> {
        await player.draw(1, true);
        player.data.actions += 4;
        player.data.buys++;
        if (!player.data.hooks.actions) player.data.hooks.actions = [];
        const hookedOnTurn = player.turnNumber;
        const cb = (oldValue: number, nextValue: number) => {
            if (player.turnNumber === hookedOnTurn && nextValue > oldValue) {
                return oldValue;
            }
            return nextValue;
        };
        player.data.hooks.actions.push(cb);
        player.events.on('turnStart', () => {
            player.data.hooks.actions!.splice(player.data.hooks.actions!.indexOf(cb), 1);
            return false;
        });
    }
}
