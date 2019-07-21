import Card from "../Card";
import Player from "../../server/Player";
import {Texts} from "../../server/Texts";

export default class Chapel extends Card {
    types = ["action"] as const;
    name = "chapel";
    cost = {
        coin: 2
    };
    cardText = "Trash up to 4 cards from your hand.";
    supplyCount = 10;
    async onAction(player: Player): Promise<void> {
        let cardsToTrash = 4;
        let card: Card | null = null;
        while (cardsToTrash > 0 && (card = await player.chooseCardFromHand(Texts.chooseCardToTrashFor('chapel'), true)) != null) {
            await player.trash(card);
            cardsToTrash--;
        }
    }
}