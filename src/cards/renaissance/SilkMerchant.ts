import Card from "../Card";
import Player from "../../server/Player";

export default class SilkMerchant extends Card {
    intrinsicTypes = ["action"] as const;
    name = "silk merchant";
    cost = {
        coin: 4
    };
    cardText = "+2 Cards\n" +
        "+1 Buy\n" +
        "---\n" +
        "When you gain or trash this, +1 Coffers and +1 Villager.";
    supplyCount = 10;
    cardArt = "/img/card-img/Silk_MerchantArt.jpg";
    async onAction(player: Player): Promise<void> {
        await player.draw(2);
        player.data.buys += 1;
    }
    onGainSelf(player: Player): Promise<void> | void {
        player.data.coffers++;
        player.data.villagers++;
    }
    onTrashSelf(player: Player): Promise<void> | void {
        player.data.coffers++;
        player.data.villagers++;
    }
}
