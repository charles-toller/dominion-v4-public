import type Player from "../../server/Player";
import Event from "../Event";
import {Texts} from "../../server/Texts";
import type CardHolder from "../../server/CardHolder";

export default class Save extends Event {
    cardArt = "/img/card-img/SaveArt.jpg";
    cardText = "Once per turn: +1 Buy. Set aside a card from your hand, and put it into your hand at end of turn (after drawing).";
    intrinsicCost = {
        coin: 1
    };
    name = "save";
    static oncePerTurn = true;
    private cardHolder: CardHolder | null = null;
    async onPurchase(player: Player): Promise<any> {
        player.data.buys++;
        const card = await player.chooseCardFromHand(Texts.chooseCardToSetAsideFor(this.name));
        if (!card) {
            return;
        }
        player.lm('%p saves %l.', [card]);
        if (this.cardHolder == null) {
            this.cardHolder = this.game.getCardHolder(player);
        }
        this.cardHolder.addCard(card);
        player.effects.setupEffect('turnEnd', this.name, {
            compatibility: {}
        }, async (remove) => {
            player.lm('%p takes the saved %c.', card.name);
            if (this.cardHolder?.isEmpty === false) {
                player.data.hand.push(this.cardHolder.popCard()!);
            }
            remove();
        });
    }
}