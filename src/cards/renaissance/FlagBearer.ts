import Card from "../Card";
import Player from "../../server/Player";
import Flag from "./Flag";

export default class FlagBearer extends Card {
    types = ["action"] as const;
    name = "flag bearer";
    cost = {
        coin: 4
    };
    cardText = "+$2\n" +
        "When you gain or trash this, take the Flag.";
    supplyCount = 10;
    cardArt = "/img/card-img/Flag_BearerArt.jpg";
    async onAction(player: Player): Promise<void> {
        player.data.money += 2;
    }
    onTrashSelf(player: Player): Promise<void> | void {
        Flag.giveTo(player);
    }

    onGainSelf(player: Player): Promise<void> | void {
        Flag.giveTo(player);
    }

    public static onChosen(): string[] {
        return ['flag'];
    }
}
