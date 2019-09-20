import Card from "../Card";
import Player from "../../server/Player";

export default class Patron extends Card {
    types = ["action", "reaction"] as const;
    name = "patron";
    cost = {
        coin: 4
    };
    cardText = "+1 Villager\n" +
        "+$2\n" +
        "When something cause you to reveal this (using the word \"reveal\"),\n" +
        "+1 Coffers";
    supplyCount = 10;
    cardArt = "/img/card-img/PatronArt.jpg";
    async onAction(player: Player): Promise<void> {
        player.data.villagers++;
        player.data.money += 2;
    }
    onRevealSelf(player: Player): Promise<void> | void {
        player.data.coffers++;
    }
}