import Card from "../Card";
import type Player from "../../server/Player";
import {Texts} from "../../server/Texts";
import Cost from "../../server/Cost";

export default class Cardinal extends Card {
    intrinsicTypes = ["action","attack"] as const;
    name = "cardinal";
    intrinsicCost = {
        coin: 4
    };
    cardText = "+$2\n" +
        "Each other player reveals the top 2 cards of their deck, Exiles one costing from $3 to $6, and discards the rest.";
    supplyCount = 10;
    cardArt = "/img/card-img/CardinalArt.jpg";
    async onPlay(player: Player, exemptPlayers: Player[]): Promise<void> {
        await player.addMoney(2);
        const range = [Cost.create(3), Cost.create(6)] as const;
        await player.attackOthers(exemptPlayers, async (p) => {
            const cards = await p.revealTop(2, true);
            const choice = await p.chooseCard(Texts.chooseCardToExileFor('cardinal'), cards.map((a) => a.viewCard()), false, (card) => card.cost.isInRange(...range), false);
            if (choice) {
                cards.find((a) => a.viewCard().id === choice.id)?.exercise();
                p.data.exile.push(choice);
            }
            await p.discard(cards.filter((a) => a.hasTrack).map((a) => a.exercise()!));
        });
    }
}
