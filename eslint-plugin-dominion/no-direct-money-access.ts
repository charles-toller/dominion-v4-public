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
function getTopNode(node: TSESTree.MemberExpression | TSESTree.Identifier): TSESTree.Node | null {
    if (!node.parent) {
        return null;
    }
    if (node.parent.type === 'MemberExpression') {
        return getTopNode(node.parent);
    }
    return node.parent;
}
function getExpressionStatement(node: TSESTree.Node): TSESTree.ExpressionStatement | null {
    if (!node.parent) return null;
    if (node.parent.type === 'ExpressionStatement') return node.parent;
    return getExpressionStatement(node.parent);
}
const allowedOperators = ["<=", ">=", "<", ">"];
module.exports = creator({
    name: 'no-direct-money-access',
    meta: {
        docs: {
            category: "Best Practices" as const,
            description: '',
            recommended: 'error' as const
        },
        messages: {
            'direct-money-access': 'Don\'t modify data.money, use player.addMoney instead'
        },
        fixable: "code",
        type: "problem",
        schema: {}
    },
    defaultOptions: [],
    create: (context) => {
        return {
            MemberExpression(node) {
                if (node.property.type === 'Identifier' && node.property.name === 'money') {
                    if (node.object.type === 'MemberExpression' || node.object.type === 'Identifier') {
                        const path = getFullPropertyPath(node);
                        if (path.split(".").slice(1).join(".") === 'data.money' && path.slice(0, 4) !== 'this') {
                            // @ts-ignore
                            const sourceFile: string = relative(context.getCwd(), context.getFilename());
                            if (sourceFile.slice(0, 9) !== `src${sep}cards`) {
                                // We don't care
                                return;
                            }
                            const parent = getTopNode(node);
                            if (parent && (parent.type === 'CallExpression' || (parent.type === 'BinaryExpression' && allowedOperators.includes(parent.operator)))) {
                                return;
                            }
                            context.report({
                                messageId: 'direct-money-access',
                                loc: node.property.loc,
                                fix: fixer => {
                                    if (parent) {
                                        const statement = getExpressionStatement(parent);
                                        if ((parent.type === 'BinaryExpression' || parent.type === 'AssignmentExpression') && statement) {
                                            return [
                                                fixer.insertTextBefore(statement, `await ${getFullPropertyPath(parent.left as any).split(".")[0]}.addMoney(${context.getSourceCode().getText(parent.right)});`),
                                                fixer.remove(statement)
                                            ];
                                        }
                                        if (parent.type === 'UpdateExpression' && statement) {
                                            return [
                                                fixer.insertTextBefore(statement, `await ${getFullPropertyPath(parent.argument as any).split(".")[0]}.addMoney(${parent.operator === "++" ? "1" : parent.operator === "--" ? "-1": ""});`),
                                                fixer.remove(statement)
                                            ];
                                        }
                                    }
                                    return null;
                                }
                            });
                        }
                    }
                }
            }
        };
    }
});