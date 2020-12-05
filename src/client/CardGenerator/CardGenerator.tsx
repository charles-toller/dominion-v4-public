import * as React from 'react';
import type {CardImplementation} from "../../cards/Card";
const colorFactorLists = {
    "action": [1, 1, 1],
    "event": [1, 1, 1],
    "treasure": [0.95, 0.7, 0.2],
    "victory": [0.35, 0.7, 0.15],
    "reaction": [0.2, 0.4, 1.05],
    "duration": [1, 0.4, 0.05],
    "reserve": [0.65, 0.45, 0.2],
    "curse": [0.6, 0.15, 0.6],
    "shelter": [1, 0.1, 0.1],
    "ruins": [0.25, 0.05, 0],
    "landmark": [0.45, 1.25, 0.85],
    "night": [0.3, 0.4, 0.45],
    "boon": [1.4, 1.35, 0.55, 0, 0, 0, 1.7, 1.25, 0.65, 1.95, 1.6, 0.4],
    "hex": [0.75, 0.6, 2.1, 0, 0, 0, 0.8, 0.8, 0.8, 1.0, 0.75, 2.1],
    "state": [1.1, 1.3, 1.3, 0.6, 0.15, 0, 1.55, 1.15, 1.05, 1.4, 0.65, 0.45],
    "artifact": [2, 0.75, 0.2, 0.3, 0.15, 0.05],
    "project": [1.9, 0.6, 0.8, 0.4, 0.2, 0.15],
    "way": [0.6, 1.1, 1.75]
};
const genericCustomAccentColors = [
    [0, 0, 0, 0, 0, 0, 1, 1, 1, 1.2, 0.8, 0.5],
    [0, 0, 0, 0, 0, 0, 0.9, 0.8, 0.7, 0.9, 0.8, 0.7]
];
interface IProps {
    cardArtUrl: string;
    heirloomLine?: string;
    cardName: string;
    cardTypes: readonly string[];
    costs: {
        coin: number;
        debt?: number;
        potion?: number;
    };
    smallDescription: boolean;
    description: string;
    factorOverrides?: [number, number, number];
    descriptionFontStart?: number;
    typeFontStart?: number;
    cardNameStart?: number;
}
const noColor = ["attack"];
function pickTypesFromTypeArray(types: readonly string[]): [string, string | undefined] {
    types = types.filter((a) => !noColor.includes(a));
    if (types.length === 1 && Object.keys(colorFactorLists).includes(types[0])) {
        return [types[0], undefined];
    }
    if (types.includes("treasure") && types.includes("reserve")) {
        return ['reserve', 'treasure'];
    }
    if (types.includes('victory') && types.includes('reserve')) {
        return ['victory', 'reserve'];
    }
    if (types.includes('reserve') && types.includes('action')) {
        return ['reserve', undefined];
    }
    if (types.includes('action') && types.includes('victory')) {
        return ['victory', 'action'];
    }
    if (types.includes('reaction') && types.includes('shelter')) {
        return ['reaction', 'shelter'];
    }
    if (types.includes('shelter') && types.includes('action')) {
        return ['action', 'shelter'];
    }
    if (types.includes('shelter') && types.includes('victory')) {
        return ['victory', 'shelter'];
    }
    if (types.includes('duration') && types.includes('reaction')) {
        return ['reaction', 'duration'];
    }
    if (types.includes('reaction')) {
        return ['reaction', undefined];
    }
    if (types.includes('ruins')) {
        return ['ruins', undefined];
    }
    if (types.includes("duration")) {
        return ['duration', undefined];
    }
    if (types.includes("way")) {
        return ['way', undefined];
    }
    return ['action', undefined];
}
function sendWindowEvent(name: string) {
    if (typeof window.dispatchEvent === 'function') {
        const e = new CustomEvent(name);
        window.dispatchEvent(e);
        // @ts-ignore
        window[name] = true;
    }
}
export default class CardGenerator extends React.Component<IProps, {}> {
    render(): React.ReactElement<any, string | React.JSXElementConstructor<any>> | string | number | {} | React.ReactNodeArray | React.ReactPortal | boolean | null | undefined {
        if (this.props.cardTypes.includes("project") || this.props.cardTypes.includes("artifact") || this.props.cardTypes.includes("event") || this.props.cardTypes.includes("way")) {
            return this.renderLandscape();
        }
        else {
            return this.renderPortrait();
        }
    }

    renderLandscape() {
        // @ts-ignore
        sendWindowEvent('renderLandscape');
        return (
            <svg viewBox={'0 0 1119 730'} style={{display: "flex", flex: 1, height: "75%", width: "100%"}}>
                <image href={this.props.cardArtUrl} x={69} y={112} width={980} height={382} preserveAspectRatio="xMidYMin slice"/>
                <RecolorFilter factors={this.props.factorOverrides || colorFactorLists[this.props.cardTypes[0]]} name={'color0'} />
                <image href="/img/card-resources/EventColorOne.png" x={0} y={0} width={1119} height={730} filter="url(#color0)" />
                <image href="/img/card-resources/EventBrown.png" x={0} y={0} width={1119} height={730} />
                <image href="/img/card-resources/EventBrown2.png" x={0} y={0} width={1119} height={730} />
                <SingleTextLine line={this.props.cardName} x={557} y={92} maxWidth={412} initialSize={this.props.cardNameStart || 30} />
                <foreignObject x={700} y={-627} width={175} height={50} fontSize={35} transform="rotate(45)">
                    <div style={{height: "100%", width: "100%", textAlign: "center", lineHeight: "1em"}}>
                        <span style={{fontFamily: "TrajanPro-Bold"}}>{this.props.cardTypes[0]}</span>
                    </div>
                </foreignObject>
                <Description
                    description={this.props.description}
                    smallDescription={this.props.smallDescription}
                    heirloomPresent={!!this.props.heirloomLine}
                    fontStart={this.props.descriptionFontStart}
                    x={76}
                    y={500}
                    width={965}
                    height={155}
                    id="description"/>
            </svg>
        );
    }
    renderPortrait(): React.ReactElement<any, string | React.JSXElementConstructor<any>> | string | number | {} | React.ReactNodeArray | React.ReactPortal | boolean | null | undefined {
        const [type, secondaryType] = pickTypesFromTypeArray(this.props.cardTypes);
        return (
            <svg viewBox={`0 0 1403 2151`} style={{display: "flex", flex: 1, height: "100%", width: "100%"}}>
                <RecolorFilter factors={this.props.factorOverrides || colorFactorLists[type]} name={'color0'} />
                {secondaryType && <RecolorFilter factors={colorFactorLists[secondaryType]} name={'color1'}/>}
                <RecolorFilter factors={colorFactorLists[type]} name={'cardGray'} offset={6} />
                <RecolorFilter factors={colorFactorLists[type]} name={'cardBrown'} offset={9} />
                <image href={this.props.cardArtUrl} width={1150} height={835} x={129} y={288.5} preserveAspectRatio="xMidYMin slice" onError={() => console.error("Missing card art")}/>
                <image href="/img/card-resources/CardColorOne.png" x={0} y={0} filter="url(#color0)"/>
                {secondaryType && <image href="/img/card-resources/CardColorTwo.png" x={0} y={0} filter="url(#color1)"/>}
                <image href="/img/card-resources/CardGray.png" x={0} y={0} filter="url(#cardGray)"/>
                <image href="/img/card-resources/CardBrown.png" x={0} y={0} filter="url(#cardBrown)"/>
                <image href="/img/card-resources/DescriptionFocus.png" x={44} y={1094} />
                {this.props.heirloomLine && <image href="/img/card-resources/Heirloom.png" x={97} y={1720} />}
                {this.props.heirloomLine && <SingleTextLine line={this.props.heirloomLine} x={701} y={1835} maxWidth={1040} initialSize={58} family="Times New Roman" style={"italic"}/>}
                <SingleTextLine line={this.props.cardName} x={701} y={242} maxWidth={1180} initialSize={this.props.cardNameStart || 75} />
                <ForceWrappingTextLine line={this.props.cardTypes.map((a, i, l) => i === 0 ? a : (l.length < 4 || i % 2 === 1) ? "\u00a0-\u00a0" + a : " - " + a).join("")} x={300} y={1865} maxWidth={890} maxHeight={120} initialSize={this.props.typeFontStart || 63} id="typeline"/>
                <image href="/img/CoinHighRes.png" x={129} y={1850} width={150} height={145} />
                <text x={205} y={1965} textAnchor="middle" style={{fontSize: "86pt", fontFamily: "TrajanPro-Bold"}}>{this.props.costs.coin}</text>
                <Description
                    description={this.props.description}
                    heirloomPresent={!!this.props.heirloomLine}
                    smallDescription={this.props.smallDescription}
                    fontStart={this.props.descriptionFontStart}
                    x={140}
                    y={1140}
                    width={1130}
                    height={this.props.heirloomLine ? 620 : 700}
                    id="description"/>
            </svg>
        );
    }
}
export function CardGeneratorWrapped(props: {card: CardImplementation; factorOverrides?: [number, number, number]}) {
    return <CardGenerator key={props.card.cardName} cardArtUrl={props.card.cardArt} cardName={props.card.cardName} cardTypes={props.card.types} costs={props.card.cost} description={props.card.cardText} smallDescription={props.card.smallText} descriptionFontStart={props.card.descriptionSize} typeFontStart={props.card.typelineSize} cardNameStart={props.card.nameSize} factorOverrides={props.factorOverrides}/>;
}
class RecolorFilter extends React.Component<{factors: number[]; name: string; offset?: number}, {}> {
    render(): React.ReactElement<any, string | React.JSXElementConstructor<any>> | string | number | {} | React.ReactNodeArray | React.ReactPortal | boolean | null | undefined {
        let factors = [...this.props.factors];
        const offset = this.props.offset || 0;
        if (this.props.offset === 0) {
            if (factors.length === 3) {
                factors.push(0, 0, 0);
            }
        }
        else {
            while (factors.length < 12) {
                // push generic custom accent colors
                factors.push(genericCustomAccentColors[0][factors.length]);
            }
            factors = [...factors.slice(offset, offset + 3), 0, 0, 0];
        }
        return (
            <filter id={this.props.name}>
                <feColorMatrix in="SourceGraphic"
                    type="matrix"
                    values={`${factors[0]} 0 0 0 ${factors[3]}\n0 ${factors[1]} 0 0 ${factors[4]}\n0 0 ${factors[2]} 0 ${factors[5]}\n0 0 0 1 0`} />
            </filter>
        );
    }
}
class ForceWrappingTextLine extends React.Component<{line: string; x: number; y: number; maxWidth: number; maxHeight: number; initialSize?: number; family?: string; style?: string; id?: string}, {size: number}> {
    foreignObjectRef = React.createRef<SVGForeignObjectElement>();
    desRef = React.createRef<HTMLDivElement>();
    fontStart: number;
    constructor(props) {
        super(props);
        this.fontStart = props.initialSize || 85;
        this.state = {
            size: this.fontStart
        };
    }
    componentDidMount() {
        setTimeout(() => {
            const foreignHeight = this.foreignObjectRef.current && this.foreignObjectRef.current.getBoundingClientRect().height;
            const desHeight = this.desRef.current && this.desRef.current.getBoundingClientRect().height;
            const foreignWidth = this.foreignObjectRef.current && this.foreignObjectRef.current.getBoundingClientRect().width;
            const desWidth = this.desRef.current && this.desRef.current.getBoundingClientRect().width;
            if (foreignHeight == null || desHeight == null || foreignHeight < desHeight || foreignWidth == null || desWidth == null || foreignWidth < desWidth) {
                window.setTimeout(() => {
                    this.setState({
                        size: this.state.size - 1
                    });
                }, 0);
            } else {
                sendWindowEvent('typelineResolved');
            }
        }, 10);
    }
    componentDidUpdate(): void {
        const foreignHeight = this.foreignObjectRef.current && this.foreignObjectRef.current.getBoundingClientRect().height;
        const desHeight = this.desRef.current && this.desRef.current.getBoundingClientRect().height;
        const foreignWidth = this.foreignObjectRef.current && this.foreignObjectRef.current.getBoundingClientRect().width;
        const desWidth = this.desRef.current && this.desRef.current.getBoundingClientRect().width;
        if (foreignHeight == null || desHeight == null || foreignHeight < desHeight || foreignWidth == null || desWidth == null || foreignWidth < desWidth) {
            window.setTimeout(() => {
                this.setState({
                    size: this.state.size - 1
                });
            }, 10);
        }
        else {
            if (this.state.size !== this.fontStart) {
                console.error(`Set typelineSize: ${this.state.size}`);
            }
            sendWindowEvent('typelineResolved');
        }
    }
    render(): React.ReactElement<any, string | React.JSXElementConstructor<any>> | string | number | {} | React.ReactNodeArray | React.ReactPortal | boolean | null | undefined {
        const baseStyle = {
            fontSize: this.state.size + "pt",
            fontFamily: this.props.family || "TrajanPro-Bold",
            fontWeight: "normal" as "normal" | "bold",
            fontStyle: "normal" as "normal" | "italic",
            whiteSpace: "inherit" as "inherit" | "nowrap",
            verticalAlign: "-webkit-baseline-middle"
        } as const;
        return (
            <foreignObject x={this.props.x} y={this.props.y} width={this.props.maxWidth} height={this.props.maxHeight} ref={this.foreignObjectRef}>
                <div style={{display: "table", position: "absolute", top: 0, left: 0, height: "100%", width: "100%"}}>
                    <div style={{width: "100%", height:"fit-content", textAlign: "center", lineHeight: this.state.size + Math.floor(this.state.size / 15) + "pt", display: "table-cell", verticalAlign: "middle"}}>
                        <span style={baseStyle} id={this.props.id} ref={this.desRef}>{this.props.line}</span>
                    </div>
                </div>
            </foreignObject>
        );
    }
}
class SingleTextLine extends React.Component<{line: string; x: number; y: number; maxWidth: number; initialSize: number; family?: string; style?: string}, {size: number}> {
    textRef = React.createRef<SVGTextElement>();
    constructor(props) {
        super(props);
        this.state = {
            size: props.initialSize
        };
    }
    componentDidMount() {
        const textWidth = this.textRef.current && this.textRef.current.getBBox();
        if (textWidth == null || textWidth.width > this.props.maxWidth) {
            window.setTimeout(() => {
                this.setState({
                    size: this.state.size - 1
                });
            }, 0);
        }
        else {
            sendWindowEvent('topResolved');
        }
    }
    componentDidUpdate(prevProps): void {
        if (prevProps !== this.props) {
            this.setState({
                size: this.props.initialSize
            });
            return;
        }
        const textWidth = this.textRef.current && this.textRef.current.getBBox();
        if (textWidth == null || textWidth.width > this.props.maxWidth) {
            window.setTimeout(() => {
                this.setState({
                    size: this.state.size - 1
                });
            }, 0);
        }
        else {
            if (this.state.size !== this.props.initialSize) {
                console.error(`Set nameSize: ${this.state.size}`);
            }
            sendWindowEvent('topResolved');
        }
    }
    render(): React.ReactElement<any, string | React.JSXElementConstructor<any>> | string | number | {} | React.ReactNodeArray | React.ReactPortal | boolean | null | undefined {
        const family = this.props.family || "TrajanPro-Bold";
        const size = this.state.size + 2;
        return <text ref={this.textRef} x={this.props.x}
            y={this.props.y}
            style={{fontFamily: family, fontSize: size + "pt", fontStyle: this.props.style || "unset"}}
            textAnchor="middle">{this.props.line}</text>;
    }
}
class Description extends React.Component<{x: number; y: number; width: number; height: number; description: string; heirloomPresent: boolean; smallDescription: boolean; fontStart?: number; id?: string}, {fontSize: number}> {
    fontStart: number;
    constructor(props) {
        super(props);
        this.fontStart = this.props.fontStart || 60;
        this.state = {
            fontSize: this.fontStart
        };
    }

    foreignObjectRef = React.createRef<SVGForeignObjectElement>();
    desRef = React.createRef<HTMLDivElement>();
    componentDidMount() {
        const foreignHeight = this.foreignObjectRef.current && this.foreignObjectRef.current.getBoundingClientRect().height;
        const desHeight = this.desRef.current && this.desRef.current.getBoundingClientRect().height;
        if (foreignHeight == null || desHeight == null || foreignHeight < desHeight) {
            window.setTimeout(() => {
                this.setState({
                    fontSize: this.state.fontSize - 1
                });
            }, 0);
        }
        else {
            sendWindowEvent('descriptionResolved');
        }
    }
    componentDidUpdate(prevProps): void {
        if (prevProps !== this.props) {
            this.fontStart = this.props.fontStart || 60;
            this.setState({
                fontSize: this.fontStart
            });
            return;
        }
        const foreignHeight = this.foreignObjectRef.current && this.foreignObjectRef.current.getBoundingClientRect().height;
        const desHeight = this.desRef.current && this.desRef.current.getBoundingClientRect().height;
        if (foreignHeight == null || desHeight == null || foreignHeight < desHeight) {
            window.setTimeout(() => {
                this.setState({
                    fontSize: this.state.fontSize - 1
                });
            }, 10);
        }
        else {
            if (this.state.fontSize !== this.fontStart) {
                console.error(`Set description size: ${this.state.fontSize}`);
            }
            sendWindowEvent('descriptionResolved');
        }
    }

    render(): React.ReactElement<any, string | React.JSXElementConstructor<any>> | string | number | {} | React.ReactNodeArray | React.ReactPortal | boolean | null | undefined {
        return (
            <foreignObject x={this.props.x} y={this.props.y} width={this.props.width} height={this.props.height} ref={this.foreignObjectRef}>
                <div style={{display: "table", position: "absolute", top: 0, left: 0, height: "100%", width: "100%"}}>
                    <div id={this.props.id} style={{width: "100%", height:"fit-content", textAlign: "center", lineHeight: this.state.fontSize + Math.floor(this.state.fontSize / 15) + "pt", display: "table-cell", verticalAlign: "middle", padding: `0 ${Math.floor(this.state.fontSize * (5/4))}pt`}} ref={this.desRef}>
                        {this.props.description.split("\n").map((text, i) => {
                            return <DescriptionLine key={i} line={text} fontSize={this.state.fontSize} />;
                        })}
                    </div>
                </div>
            </foreignObject>
        );
    }
}
class DescriptionLine extends React.Component<{line: string; fontSize: number}, {}> {
    render() {
        const baseStyle = {
            fontSize: this.props.fontSize + "pt",
            fontFamily: "Times New Roman",
            fontWeight: "normal" as "normal" | "bold",
            fontStyle: "normal" as "normal" | "italic",
            whiteSpace: "inherit" as "inherit" | "nowrap"
        } as const;
        const phrases = this.props.line.split(/(\+\d+\s*(?:[a-z]|[A-Z])*)|([+-]?\$\d*)|([+-]?\d+VP)|(---)|(\([^(]*?This is not in the Supply.\))|(i\([^(]*?\))/g).filter((a) => a);
        return phrases.map((a, i) => {
            const thisStyle = {
                ...baseStyle
            };
            if (/^[+-]/.test(a)) {
                console.log(`making "${a}" bold`);
                thisStyle.fontSize = this.props.fontSize + Math.floor(this.props.fontSize / 15) + "pt";
                thisStyle.fontWeight = "bold";
            }
            if (/\$/.test(a)) {
                const [, pre, amount, post] = /^(.*?)\$(\d*)(.*?)/g.exec(a)!;
                thisStyle.whiteSpace = "nowrap";
                return (
                    <span key={i} style={thisStyle}>
                        {pre.trimRight()}<CoinIcon amount={amount} multiplier={phrases.length === 1 ? 1.5 : 1.2} />{post.trimLeft()}
                    </span>
                );
            }
            if (/VP/.test(a)) {
                const [, pre, post] = /^(.*?)VP(.*?)/g.exec(a)!;
                thisStyle.whiteSpace = "nowrap";
                return (
                    <span key={i} style={thisStyle}>
                        {pre.trimRight()}
                        <VPIcon multiplier={phrases.length === 1 ? 1.5 : 1.2}/>
                        {post.trimLeft()}
                    </span>
                );
            }
            if (/---/.test(a)) {
                return <hr key={i} style={{borderColor: "black", borderWidth: "3px", margin: this.props.fontSize * 0.5 + "pt"}} />;
            }
            if (/\([^(]*?This is not in the Supply.\)/.test(a)) {
                thisStyle.fontStyle = "italic";
            }
            if (/i\([^(]*?\)/.test(a)) {
                thisStyle.fontStyle = "italic";
                a = `(${/i\(([^(]*)?\)/.exec(a)![1]})`;
            }
            return <span key={i} style={thisStyle}>{a}</span>;
        }).concat([phrases.length === 1 && phrases[0] === "---" ? <span key={phrases.length} /> : <br key={phrases.length} />]);
    }
}
class CoinIcon extends React.Component<{amount: string; multiplier: number}> {
    render() {
        return (
            <svg height={this.props.multiplier + "em"} width={this.props.multiplier + "em"} viewBox="0 0 100 100" style={{verticalAlign: 'middle'}}>
                <desc>{this.props.amount} coins</desc>
                <image xlinkHref="/img/CoinHighRes.png" x="0" y="0" height="100" width="100"/>
                <text x={("" + this.props.amount).length > 1 ? "14":"28.5"} y="75" fontSize="70" letterSpacing="-12" style={{fontWeight: "normal", fontFamily: "TrajanPro-Bold"}}>{this.props.amount}</text>
            </svg>
        );
    }
}
function VPIcon(props: {multiplier: number}) {
    return (
        <svg height={props.multiplier + "em"} width={props.multiplier + "em"} viewBox="0 0 100 100" style={{verticalAlign: 'middle'}}>
            <desc>Victory Point</desc>
            <image xlinkHref="/img/VP.png" x="0" y="0" height="100" width="100"/>
        </svg>
    );
}