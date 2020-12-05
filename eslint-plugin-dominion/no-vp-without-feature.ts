import {ESLintUtils, TSESTree} from '@typescript-eslint/experimental-utils';
import {relative, sep} from "path";
const creator = ESLintUtils.RuleCreator((name) => `http://github.com/${name}`);
function getFullPropertyPath(node: TSESTree.MemberExpression | TSESTree.Identifier): string {
    if (node.type === 'MemberExpression') {
        return getFullPropertyPath(node.object as any) + "." + (node.property as TSESTree.Identifier).name;
    }
    // @ts-ignore
    else if (node.type === 'ThisExpression') {
        return 'this';
    }
    else {
        return (node as TSESTree.Identifier).name;
    }
}
module.exports = creator({
    name: 'no-vp-without-feature',
    meta: {
        docs: {
            category: "Best Practices" as const,
            description: '',
            recommended: 'error' as const
        },
        messages: {
            'vp-in-ambient': 'The VP property was used in a non-class context',
            'vp-with-no-features-array': 'The VP property was used without a features array',
            'features-property-not-array': 'The features card property is not an array',
            'vp-with-no-vp-feature': 'The VP property was used without a matching vp feature declaration'
        },
        type: "problem",
        schema: {}
    },
    defaultOptions: [],
    create: (context) => {
        return {
            MemberExpression(node) {
                if (node.property.type === 'Identifier' && node.property.name === 'vp') {
                    if (node.object.type === 'MemberExpression' || node.object.type === 'Identifier') {
                        const path = getFullPropertyPath(node);
                        if (path.split(".").slice(1).join(".") === 'data.vp' && path.slice(0, 4) !== 'this') {
                            // @ts-ignore
                            const sourceFile: string = relative(context.getCwd(), context.getFilename());
                            if (sourceFile.slice(0, 9) !== `src${sep}cards`) {
                                // We don't care
                                return;
                            }
                            let klass = node.parent;
                            while (klass && klass.type !== 'ClassDeclaration' && klass.type !== 'Program') {
                                klass = klass.parent;
                            }
                            if (!klass || klass.type === 'Program') {
                                context.report({
                                    messageId: 'vp-in-ambient',
                                    loc: node.property.loc
                                });
                                return;
                            }
                            else if (klass.type === 'ClassDeclaration') {
                                const features: TSESTree.ClassProperty | undefined = klass.body.body.find((node) => {
                                    return node.type === 'ClassProperty' && ((node.key as any).name || (node.key as any).value) === 'features';
                                }) as any;
                                if (!features) {
                                    context.report({
                                        messageId: 'vp-with-no-features-array',
                                        loc: node.property.loc
                                    });
                                    return;
                                }
                                let value = features.value;
                                if (value == null) {
                                    return;
                                }
                                while (value.type === 'TSAsExpression') {
                                    value = value.expression;
                                }
                                if (value.type !== 'ArrayExpression') {
                                    context.report({
                                        messageId: 'features-property-not-array',
                                        loc: value.loc
                                    });
                                    return;
                                }
                                if (value.elements.find((a) => a.type === 'Literal' && a.value === "vp") == null) {
                                    context.report({
                                        messageId: 'vp-with-no-vp-feature',
                                        loc: node.property.loc
                                    });
                                }
                            }
                        }
                    }
                }
            }
        };
    }
});