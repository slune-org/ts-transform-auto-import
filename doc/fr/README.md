# ts-transform-auto-import - Transformateur typescript pour requérir tous les fichiers correspondants à un patron

Ce transformateur complète l'initialisation d'une variable d'un fichier avec le contenu de fichiers correspondants à un patron (glob). Par exemple, avec la structure de fichiers suivante :

    .
    └── themes/
        ├── index.ts
        ├── dark.ts
        ├── magic.ts
        └── partial/
            ├── light.ts
            └── stars.ts

et ce contenu :

```typescript
// themes/index.ts
import { Theme, createTheme } from '../Theme/index.js'

const allThemes: { [name: string]: Theme } = {}

Object.entries(allThemes).forEach(([name, theme]) => createTheme(name, theme))
```

le transformateur va remplir la variable `allThemes` afin que le fichier devienne :

```typescript
// themes/index.ts
import auto_import_1 from './dark.ts'
import auto_import_2 from './magic.ts'
import auto_import_3 from './partial/light.ts'
import auto_import_4 from './partial/stars.ts'
import { Theme, createTheme } from '../Theme/index.js'

const allThemes: { [name: string]: Theme } = {
  'dark.ts': auto_import_1,
  'magic.ts': auto_import_2,
  'partial/light.ts': auto_import_3,
  'partial/stars.ts': auto_import_4,
}

Object.entries(allThemes).forEach(([name, theme]) => createTheme(name, theme))
```

# Langue

Les documents et messages, le code (y compris les noms de variable et commentaires), sont en anglais.

Cependant, Slune étant une entreprise française, tous les documents et messages importants doivent également être fournis en français. Les autres traductions sont bienvenues.

# Installation

L’installation se fait avec la commande `npm install` :

```bash
$ npm install --save-dev ts-transform-auto-import
```

# Pourquoi aurai-je besoin de ça ?

Vous avez une application extensible dans laquelle vous pouvez ajouter des locales, des ajouts, des chargeurs, des thèmes ou quoi que vous vouliez, et vous avez besoin d'un lieu pour les importer tous (probablement un fichier d'index) pour les rendre accessibles dans l'application. Comment allez-vous gérer cela ?

- Vous pouvez manuellement mettre à jour le fichier d'aggrégation chaque fois que vous créez un nouveau fichier d'extention… à condition de ne pas l'oublier ! Dans les grandes organisations, il est plutôt facile d'oublier sans même sans rendre compte, de manière à ce que le nouveau fichier ne soit jamais utilisé.
- Vous pouvez lire et importer les fichiers à l'exécution. Cela nécessitera de coder le processus de recherche des fichiers, ce qui consommera du temps. Il pourra même y avoir des situations où cela ne fonctionnera pas (par exemple, si le module est exécuté dans un navigateur).
- Vous pouvez écrire un outil qui crée le fichier d'index à la génération. Afin de ne pas l'oublier, vous devriez l'ajouter à votre procédure de génération. Mais vous allez devoir également fournir au moins un faux fichier d'aggrégation afin que _TypeScript_ puisse effectuer les contrôles de type, ou pour les tests unitaires.

En utilisant le transformateur, vous n'aurez pas besoin de faire cela. Écrivez simplement votre fichier d'aggrégation, qui contient une variable initialisée. Il est même possible d'y mettre une fausse initialisation, si vous en avez besoin pour des tests, elle sera remplacée par le transformateur. Une fois cela fait, vous pouvez ajouter vos fichiers d'extentions, et ils seront automatiquement ajoutés à la variable.

Ce transformateur est particulièrement prévu pour les modules ES. Si vous souhaitez construire des modules CommonJS, regardez plutôt [ts-transform-auto-require](https://github.com/slune-org/ts-transform-auto-require).

# Utilisation

Le transformateur contient sa configuration sous le paramètre `autoImports`, qui est un tableau d'objets contenant :

- `source`: la définition de la source, les fichiers à requérir — c'est un objet obligatoire contenant :
  - `glob`: le patron [glob](https://www.npmjs.com/package/glob) utilisé pour sélectionner les fichiers, relatif à la racine du projet — ce paramètre est requis ;
  - `ignore`: une chaine de caractères ou un tableau de chaines de caractères pour les fichiers à ignorer — la valeur est transmise directement à l'option `ignore` de [glob](https://www.npmjs.com/package/glob) — ce paramètre est optionel ;
- `target`: la définition de la cible, là où la variable à initialiser sera trouvée — c'est un objet obligatoire qui contient :
  - `file`: le nom du fichier qui contient la variable (requis) ;
  - `variable`: le nom de la variable à initialiser avec les `import`s (requis) ;
  - `extensionRewrite`: un dictionnaire d’extentions de fichiers source et leur valeur convertie après compilation — par défaut, `{ ts: 'js', tsx: 'jsx' }`.

Il n'y a actuellement pas moyen de déclarer un transformateur dans le compilateur _TypeScript_ standard. Si vous ne souhaitez pas écrire votre propre compilateur en utilisant l'API `typescript`, vous pouvez utiliser la surcouche [ttypescript](https://www.npmjs.com/package/ttypescript).

## Remplissage automatique

La portion de code à remplir par le transformateur doit suivre ces règles :

- cela **doit** être une déclaration de variable utilisant `const`, `let` ou `var` ;
- le nom de variable **peut** être suivi d'une définition de type ;
- la variable **doit** être suivie par une initialisation immédiate ;
- la valeur de l'initialisation **doit** être un litéral d'objet ;
- l'objet d'initialisation **peut** être vide ou non ;
- l'initialisation **peut** être suivie par un transtypage.

Toutes les déclarations de variables ci-dessous sont valables pour le remplissage automatique :

```typescript
const allThemes: { [name: string]: Theme } = {}
let loaders = {} as { [name: string]: Loader; default: Loader }
var myVar = { fake: 'Fausse valeur de test' }
```

## Noms des fichiers importés

Les chemins des fichiers de code source importés sont traités ainsi :

- le nom (avec chemin) du fichier est pris relativement au fichier cible ;
- l'extention est convertie si elle est présente dans le paramètre `extensionRewrite` (nécessaire pour, par exemple, les fichiers _TypeScript_ `.ts` qui sont transpilés en `.js` à l'exécution) pour l’import ;
- l’extention originale est utilisée dans la clé de la variable.

Par exemple, dans un fichier d'index qui collecte tous des fichiers dans le même répertoire, la clé d'objet est simplement le nom du fichier avant compilation, sans chemin. Si le fichier est dans un sous-répertoire, son nom sera également présent (par exemple, `sousrep/fichier`). S'il est nécessaire de remonter dans les répertoires pour atteindre le fichier, la clé d'objet commencera par `..`.

## Configuration avec ttypescript

Pour `ttypescript`, configurez votre fichier `tsconfig.json`. Par exemple :

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "ts-transform-auto-import",
        "autoImports": [
          {
            "source": {
              "glob": "themes/**/*.ts",
              "ignore": ["**/index.ts", "**/*.spec.ts"]
            },
            "target": {
              "file": "themes/index.ts",
              "variable": "allThemes"
            }
          },
          {
            "source": { "glob": "**/loader-*.mts" },
            "target": {
              "file": "loader.ts",
              "variable": "loaders",
              "codeExtensions": { "mts": "mjs" }
            }
          }
        ]
      }
    ]
  }
}
```

Le transformateur est de type `program` (qui est le type par défaut pour `ttypescript`).

# Notes

- Le même nom de fichier, et même la même cible complète peut apparaitre plusieurs fois dans la configuration. Tous les `import`s correspondants seront fusionnés.
- Tous les variables correspondantes seront complètées, alors assurez-vous de ne pas avoir plusieurs variables avec le nom configuré (le transformateur ne tient pas compte des portées).
- Les fichiers à importer doivent être sous la racine du projet. Les fichiers hors de la racine du projet seront ignorés, même s'ils correspondent au glob fourni.

# Contribuer

Bien que nous ne puissions pas garantir un temps de réponse, n’hésitez pas à ouvrir un incident si vous avez une question ou un problème pour utiliser ce paquet.

Les _Pull Requests_ sont bienvenues. Vous pouvez bien sûr soumettre des corrections ou améliorations de code, mais n’hésitez pas également à améliorer la documentation, même pour de petites fautes d’orthographe ou de grammaire.
