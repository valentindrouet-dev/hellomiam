// Contenu livré avec l'application : quatre recettes d'exemple (une par
// catégorie) et une base de prix de référence Carrefour indicatifs, tous
// modifiables depuis l'appli.

export const SEED_RECIPES = [
  {
    "title": "Poulet crémeux au paprika, riz aux poivrons",
    "category": "hellofresh",
    "servings": 2,
    "prepMin": 15,
    "cookMin": 25,
    "notes": "Fiche HelloFresh — exemple fourni avec l'appli",
    "ingredients": [
      {
        "name": "Filet de poulet",
        "qty": 300,
        "unit": "g",
        "dept": "boucherie"
      },
      {
        "name": "Riz",
        "qty": 150,
        "unit": "g",
        "dept": "epicerie"
      },
      {
        "name": "Poivron rouge",
        "qty": 1,
        "unit": "pièce",
        "dept": "fruits-legumes"
      },
      {
        "name": "Oignon",
        "qty": 1,
        "unit": "pièce",
        "dept": "fruits-legumes"
      },
      {
        "name": "Ail",
        "qty": 1,
        "unit": "gousse",
        "dept": "fruits-legumes"
      },
      {
        "name": "Crème fraîche",
        "qty": 10,
        "unit": "cl",
        "dept": "cremerie"
      },
      {
        "name": "Concentré de tomates",
        "qty": 2,
        "unit": "c. à soupe",
        "dept": "epicerie"
      },
      {
        "name": "Paprika",
        "qty": 1,
        "unit": "c. à café",
        "dept": "epicerie"
      },
      {
        "name": "Bouillon de volaille",
        "qty": 1,
        "unit": "cube",
        "dept": "epicerie"
      },
      {
        "name": "Huile d'olive",
        "qty": 1,
        "unit": "c. à soupe",
        "dept": "epicerie"
      },
      {
        "name": "Sel",
        "qty": null,
        "unit": null,
        "dept": "epicerie"
      },
      {
        "name": "Poivre",
        "qty": null,
        "unit": null,
        "dept": "epicerie"
      }
    ],
    "steps": [
      "Porte à ébullition une casserole d'eau avec le cube de bouillon. Verse le riz et fais-le cuire 12 min, puis égoutte-le.",
      "Pendant ce temps, émince l'oignon, coupe le poivron en lanières et hache l'ail.",
      "Coupe le poulet en morceaux de 2 cm. Sale et poivre.",
      "Fais chauffer l'huile d'olive dans une sauteuse à feu vif. Fais dorer le poulet 4 à 5 min, puis réserve-le dans une assiette.",
      "Dans la même sauteuse, fais revenir l'oignon, le poivron et l'ail 5 min à feu moyen. Ajoute le paprika et le concentré de tomates, remue 1 min.",
      "Remets le poulet, ajoute la crème fraîche et un demi-verre d'eau. Laisse mijoter 5 min à feu doux. Sers avec le riz."
    ]
  },
  {
    "title": "Gratin dauphinois de Mamie",
    "category": "perso",
    "servings": 4,
    "prepMin": 20,
    "cookMin": 75,
    "notes": "La vraie recette de famille : sans fromage, comme le veut la tradition !",
    "ingredients": [
      {
        "name": "Pomme de terre",
        "qty": 1.2,
        "unit": "kg",
        "dept": "fruits-legumes"
      },
      {
        "name": "Crème liquide",
        "qty": 40,
        "unit": "cl",
        "dept": "cremerie"
      },
      {
        "name": "Lait entier",
        "qty": 25,
        "unit": "cl",
        "dept": "cremerie"
      },
      {
        "name": "Ail",
        "qty": 2,
        "unit": "gousse",
        "dept": "fruits-legumes"
      },
      {
        "name": "Beurre",
        "qty": 20,
        "unit": "g",
        "dept": "cremerie"
      },
      {
        "name": "Noix de muscade",
        "qty": 1,
        "unit": "pincée",
        "dept": "epicerie"
      },
      {
        "name": "Sel",
        "qty": null,
        "unit": null,
        "dept": "epicerie"
      },
      {
        "name": "Poivre",
        "qty": null,
        "unit": null,
        "dept": "epicerie"
      }
    ],
    "steps": [
      "Préchauffe le four à 160 °C. Épluche les pommes de terre et coupe-les en fines rondelles (3 mm), sans les rincer : l'amidon lie le gratin.",
      "Frotte un plat à gratin avec une gousse d'ail coupée en deux, puis beurre-le généreusement.",
      "Dans une casserole, fais chauffer le lait et la crème avec l'ail écrasé, la muscade, du sel et du poivre.",
      "Range les rondelles de pommes de terre en couches dans le plat, puis verse le mélange chaud dessus.",
      "Enfourne 1 h 15. Le dessus doit être bien doré et la pointe d'un couteau doit s'enfoncer sans résistance. Laisse reposer 10 min avant de servir."
    ]
  },
  {
    "title": "Bo bun comme au restaurant",
    "category": "resto",
    "servings": 2,
    "prepMin": 25,
    "cookMin": 10,
    "notes": "Reproduction du bo bun de notre petit vietnamien préféré",
    "ingredients": [
      {
        "name": "Vermicelles de riz",
        "qty": 200,
        "unit": "g",
        "dept": "epicerie"
      },
      {
        "name": "Rumsteck",
        "qty": 300,
        "unit": "g",
        "dept": "boucherie"
      },
      {
        "name": "Carotte",
        "qty": 1,
        "unit": "pièce",
        "dept": "fruits-legumes"
      },
      {
        "name": "Concombre",
        "qty": 0.5,
        "unit": "pièce",
        "dept": "fruits-legumes"
      },
      {
        "name": "Salade",
        "qty": 0.5,
        "unit": "pièce",
        "dept": "fruits-legumes"
      },
      {
        "name": "Menthe",
        "qty": 0.5,
        "unit": "botte",
        "dept": "fruits-legumes"
      },
      {
        "name": "Coriandre",
        "qty": 0.5,
        "unit": "botte",
        "dept": "fruits-legumes"
      },
      {
        "name": "Cacahuètes",
        "qty": 40,
        "unit": "g",
        "dept": "epicerie"
      },
      {
        "name": "Nems",
        "qty": 4,
        "unit": "pièce",
        "dept": "surgeles"
      },
      {
        "name": "Nuoc-mâm",
        "qty": 4,
        "unit": "c. à soupe",
        "dept": "epicerie"
      },
      {
        "name": "Sucre",
        "qty": 2,
        "unit": "c. à soupe",
        "dept": "epicerie-sucree"
      },
      {
        "name": "Citron vert",
        "qty": 1,
        "unit": "pièce",
        "dept": "fruits-legumes"
      },
      {
        "name": "Ail",
        "qty": 1,
        "unit": "gousse",
        "dept": "fruits-legumes"
      }
    ],
    "steps": [
      "Prépare la sauce : mélange le nuoc-mâm, le sucre, le jus du citron vert, l'ail haché et 6 c. à soupe d'eau. Réserve.",
      "Fais tremper les vermicelles de riz dans de l'eau bouillante 4 min, égoutte et rince à l'eau froide.",
      "Râpe la carotte, coupe le concombre en bâtonnets, cisèle la salade, effeuille la menthe et la coriandre.",
      "Fais réchauffer les nems au four 10 min à 180 °C, puis coupe-les en deux.",
      "Émince le bœuf et saisis-le 2 min à feu très vif avec un peu d'huile.",
      "Monte les bols : vermicelles, salade et crudités, bœuf, nems, herbes et cacahuètes concassées. Arrose de sauce au moment de servir."
    ]
  },
  {
    "title": "Curry de pois chiches express",
    "category": "claude",
    "servings": 3,
    "prepMin": 10,
    "cookMin": 20,
    "notes": "Recette créée par Claude — végétarienne et prête en 30 minutes",
    "ingredients": [
      {
        "name": "Pois chiches",
        "qty": 1,
        "unit": "boîte",
        "dept": "epicerie"
      },
      {
        "name": "Lait de coco",
        "qty": 40,
        "unit": "cl",
        "dept": "epicerie"
      },
      {
        "name": "Tomates concassées",
        "qty": 1,
        "unit": "boîte",
        "dept": "epicerie"
      },
      {
        "name": "Oignon",
        "qty": 1,
        "unit": "pièce",
        "dept": "fruits-legumes"
      },
      {
        "name": "Ail",
        "qty": 2,
        "unit": "gousse",
        "dept": "fruits-legumes"
      },
      {
        "name": "Gingembre",
        "qty": 20,
        "unit": "g",
        "dept": "fruits-legumes"
      },
      {
        "name": "Curry en poudre",
        "qty": 1,
        "unit": "c. à soupe",
        "dept": "epicerie"
      },
      {
        "name": "Épinard frais",
        "qty": 200,
        "unit": "g",
        "dept": "fruits-legumes"
      },
      {
        "name": "Riz basmati",
        "qty": 180,
        "unit": "g",
        "dept": "epicerie"
      },
      {
        "name": "Huile de tournesol",
        "qty": 1,
        "unit": "c. à soupe",
        "dept": "epicerie"
      },
      {
        "name": "Coriandre",
        "qty": 0.5,
        "unit": "botte",
        "dept": "fruits-legumes"
      }
    ],
    "steps": [
      "Lance la cuisson du riz basmati selon les indications du paquet.",
      "Émince l'oignon, hache l'ail et râpe le gingembre. Fais-les revenir 3 min dans l'huile à feu moyen.",
      "Ajoute le curry, remue 30 secondes, puis verse les tomates concassées et le lait de coco. Laisse mijoter 5 min.",
      "Ajoute les pois chiches égouttés et rincés. Laisse mijoter 10 min à feu doux.",
      "Incorpore les épinards jusqu'à ce qu'ils tombent, rectifie l'assaisonnement. Sers sur le riz, parsemé de coriandre."
    ]
  }
]

export const SEED_PRICES = [
  {
    "name": "Pomme de terre",
    "unit": "kg",
    "unitQty": 1,
    "price": 1.5,
    "dept": "fruits-legumes",
    "loose": true
  },
  {
    "name": "Carotte",
    "unit": "kg",
    "unitQty": 1,
    "price": 1.3,
    "dept": "fruits-legumes",
    "loose": true
  },
  {
    "name": "Oignon",
    "unit": "kg",
    "unitQty": 1,
    "price": 1.8,
    "dept": "fruits-legumes",
    "loose": true
  },
  {
    "name": "Oignon rouge",
    "unit": "kg",
    "unitQty": 1,
    "price": 2.5,
    "dept": "fruits-legumes",
    "loose": true
  },
  {
    "name": "Échalote",
    "unit": "kg",
    "unitQty": 1,
    "price": 3.5,
    "dept": "fruits-legumes",
    "loose": true
  },
  {
    "name": "Ail",
    "unit": "pièce",
    "unitQty": 1,
    "price": 0.8,
    "dept": "fruits-legumes",
    "loose": true
  },
  {
    "name": "Tomate",
    "unit": "kg",
    "unitQty": 1,
    "price": 2.8,
    "dept": "fruits-legumes",
    "loose": true
  },
  {
    "name": "Tomate cerise",
    "unit": "g",
    "unitQty": 250,
    "price": 1.9,
    "dept": "fruits-legumes",
    "loose": false
  },
  {
    "name": "Courgette",
    "unit": "kg",
    "unitQty": 1,
    "price": 2.2,
    "dept": "fruits-legumes",
    "loose": true
  },
  {
    "name": "Aubergine",
    "unit": "kg",
    "unitQty": 1,
    "price": 2.9,
    "dept": "fruits-legumes",
    "loose": true
  },
  {
    "name": "Poivron rouge",
    "unit": "pièce",
    "unitQty": 1,
    "price": 1.1,
    "dept": "fruits-legumes",
    "loose": true
  },
  {
    "name": "Poivron vert",
    "unit": "pièce",
    "unitQty": 1,
    "price": 1,
    "dept": "fruits-legumes",
    "loose": true
  },
  {
    "name": "Concombre",
    "unit": "pièce",
    "unitQty": 1,
    "price": 1.1,
    "dept": "fruits-legumes",
    "loose": true
  },
  {
    "name": "Salade",
    "unit": "pièce",
    "unitQty": 1,
    "price": 1.2,
    "dept": "fruits-legumes",
    "loose": true
  },
  {
    "name": "Laitue",
    "unit": "pièce",
    "unitQty": 1,
    "price": 1.2,
    "dept": "fruits-legumes",
    "loose": true
  },
  {
    "name": "Champignon de Paris",
    "unit": "g",
    "unitQty": 500,
    "price": 2.2,
    "dept": "fruits-legumes",
    "loose": false
  },
  {
    "name": "Brocoli",
    "unit": "pièce",
    "unitQty": 1,
    "price": 1.7,
    "dept": "fruits-legumes",
    "loose": true
  },
  {
    "name": "Chou-fleur",
    "unit": "pièce",
    "unitQty": 1,
    "price": 2.8,
    "dept": "fruits-legumes",
    "loose": true
  },
  {
    "name": "Poireau",
    "unit": "kg",
    "unitQty": 1,
    "price": 2.9,
    "dept": "fruits-legumes",
    "loose": true
  },
  {
    "name": "Épinard frais",
    "unit": "g",
    "unitQty": 200,
    "price": 1.8,
    "dept": "fruits-legumes",
    "loose": false
  },
  {
    "name": "Haricot vert",
    "unit": "kg",
    "unitQty": 1,
    "price": 4.5,
    "dept": "fruits-legumes",
    "loose": true
  },
  {
    "name": "Avocat",
    "unit": "pièce",
    "unitQty": 1,
    "price": 1.3,
    "dept": "fruits-legumes",
    "loose": true
  },
  {
    "name": "Citron",
    "unit": "pièce",
    "unitQty": 1,
    "price": 0.7,
    "dept": "fruits-legumes",
    "loose": true
  },
  {
    "name": "Citron vert",
    "unit": "pièce",
    "unitQty": 1,
    "price": 0.6,
    "dept": "fruits-legumes",
    "loose": true
  },
  {
    "name": "Pomme",
    "unit": "kg",
    "unitQty": 1,
    "price": 2.5,
    "dept": "fruits-legumes",
    "loose": true
  },
  {
    "name": "Banane",
    "unit": "kg",
    "unitQty": 1,
    "price": 1.9,
    "dept": "fruits-legumes",
    "loose": true
  },
  {
    "name": "Poire",
    "unit": "kg",
    "unitQty": 1,
    "price": 2.9,
    "dept": "fruits-legumes",
    "loose": true
  },
  {
    "name": "Fraise",
    "unit": "g",
    "unitQty": 250,
    "price": 3,
    "dept": "fruits-legumes",
    "loose": false
  },
  {
    "name": "Gingembre",
    "unit": "kg",
    "unitQty": 1,
    "price": 6.5,
    "dept": "fruits-legumes",
    "loose": true
  },
  {
    "name": "Patate douce",
    "unit": "kg",
    "unitQty": 1,
    "price": 2.6,
    "dept": "fruits-legumes",
    "loose": true
  },
  {
    "name": "Butternut",
    "unit": "kg",
    "unitQty": 1,
    "price": 2.2,
    "dept": "fruits-legumes",
    "loose": true
  },
  {
    "name": "Menthe",
    "unit": "botte",
    "unitQty": 1,
    "price": 1.5,
    "dept": "fruits-legumes",
    "loose": false
  },
  {
    "name": "Coriandre",
    "unit": "botte",
    "unitQty": 1,
    "price": 1.5,
    "dept": "fruits-legumes",
    "loose": false
  },
  {
    "name": "Persil",
    "unit": "botte",
    "unitQty": 1,
    "price": 1.3,
    "dept": "fruits-legumes",
    "loose": false
  },
  {
    "name": "Basilic",
    "unit": "botte",
    "unitQty": 1,
    "price": 2,
    "dept": "fruits-legumes",
    "loose": false
  },
  {
    "name": "Ciboulette",
    "unit": "botte",
    "unitQty": 1,
    "price": 1.5,
    "dept": "fruits-legumes",
    "loose": false
  },
  {
    "name": "Thym",
    "unit": "botte",
    "unitQty": 1,
    "price": 1.5,
    "dept": "fruits-legumes",
    "loose": false
  },
  {
    "name": "Filet de poulet",
    "unit": "kg",
    "unitQty": 1,
    "price": 11.5,
    "dept": "boucherie",
    "loose": true
  },
  {
    "name": "Cuisse de poulet",
    "unit": "kg",
    "unitQty": 1,
    "price": 6.5,
    "dept": "boucherie",
    "loose": true
  },
  {
    "name": "Poulet entier",
    "unit": "kg",
    "unitQty": 1,
    "price": 5.9,
    "dept": "boucherie",
    "loose": true
  },
  {
    "name": "Escalope de dinde",
    "unit": "kg",
    "unitQty": 1,
    "price": 10.9,
    "dept": "boucherie",
    "loose": true
  },
  {
    "name": "Bœuf haché",
    "unit": "kg",
    "unitQty": 1,
    "price": 11.9,
    "dept": "boucherie",
    "loose": true
  },
  {
    "name": "Steak haché",
    "unit": "g",
    "unitQty": 250,
    "price": 3.3,
    "dept": "boucherie",
    "loose": false
  },
  {
    "name": "Rumsteck",
    "unit": "kg",
    "unitQty": 1,
    "price": 17.9,
    "dept": "boucherie",
    "loose": true
  },
  {
    "name": "Bœuf à bourguignon",
    "unit": "kg",
    "unitQty": 1,
    "price": 13.9,
    "dept": "boucherie",
    "loose": true
  },
  {
    "name": "Lardons",
    "unit": "g",
    "unitQty": 200,
    "price": 2.1,
    "dept": "boucherie",
    "loose": false
  },
  {
    "name": "Jambon blanc",
    "unit": "tranche",
    "unitQty": 4,
    "price": 2.6,
    "dept": "boucherie",
    "loose": false
  },
  {
    "name": "Chorizo",
    "unit": "g",
    "unitQty": 225,
    "price": 3,
    "dept": "boucherie",
    "loose": false
  },
  {
    "name": "Saucisse de Toulouse",
    "unit": "kg",
    "unitQty": 1,
    "price": 9.9,
    "dept": "boucherie",
    "loose": true
  },
  {
    "name": "Merguez",
    "unit": "kg",
    "unitQty": 1,
    "price": 10.9,
    "dept": "boucherie",
    "loose": true
  },
  {
    "name": "Côte de porc",
    "unit": "kg",
    "unitQty": 1,
    "price": 8.5,
    "dept": "boucherie",
    "loose": true
  },
  {
    "name": "Filet mignon de porc",
    "unit": "kg",
    "unitQty": 1,
    "price": 12.9,
    "dept": "boucherie",
    "loose": true
  },
  {
    "name": "Magret de canard",
    "unit": "kg",
    "unitQty": 1,
    "price": 19.9,
    "dept": "boucherie",
    "loose": true
  },
  {
    "name": "Pavé de saumon",
    "unit": "kg",
    "unitQty": 1,
    "price": 22,
    "dept": "poissonnerie",
    "loose": true
  },
  {
    "name": "Dos de cabillaud",
    "unit": "kg",
    "unitQty": 1,
    "price": 19.5,
    "dept": "poissonnerie",
    "loose": true
  },
  {
    "name": "Crevette",
    "unit": "g",
    "unitQty": 200,
    "price": 4.5,
    "dept": "poissonnerie",
    "loose": false
  },
  {
    "name": "Thon en boîte",
    "unit": "boîte",
    "unitQty": 1,
    "price": 1.8,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Moules",
    "unit": "kg",
    "unitQty": 1,
    "price": 4.5,
    "dept": "poissonnerie",
    "loose": true
  },
  {
    "name": "Lait",
    "unit": "l",
    "unitQty": 1,
    "price": 1.15,
    "dept": "cremerie",
    "loose": false
  },
  {
    "name": "Lait entier",
    "unit": "l",
    "unitQty": 1,
    "price": 1.25,
    "dept": "cremerie",
    "loose": false
  },
  {
    "name": "Beurre",
    "unit": "g",
    "unitQty": 250,
    "price": 2.6,
    "dept": "cremerie",
    "loose": false
  },
  {
    "name": "Beurre demi-sel",
    "unit": "g",
    "unitQty": 250,
    "price": 2.6,
    "dept": "cremerie",
    "loose": false
  },
  {
    "name": "Crème fraîche",
    "unit": "cl",
    "unitQty": 20,
    "price": 1.2,
    "dept": "cremerie",
    "loose": false
  },
  {
    "name": "Crème liquide",
    "unit": "cl",
    "unitQty": 20,
    "price": 1.1,
    "dept": "cremerie",
    "loose": false
  },
  {
    "name": "Œuf",
    "unit": "pièce",
    "unitQty": 6,
    "price": 1.9,
    "dept": "cremerie",
    "loose": false
  },
  {
    "name": "Yaourt nature",
    "unit": "pièce",
    "unitQty": 4,
    "price": 1.8,
    "dept": "cremerie",
    "loose": false
  },
  {
    "name": "Emmental râpé",
    "unit": "g",
    "unitQty": 200,
    "price": 2.3,
    "dept": "cremerie",
    "loose": false
  },
  {
    "name": "Parmesan",
    "unit": "g",
    "unitQty": 70,
    "price": 2.5,
    "dept": "cremerie",
    "loose": false
  },
  {
    "name": "Mozzarella",
    "unit": "pièce",
    "unitQty": 1,
    "price": 1.1,
    "dept": "cremerie",
    "loose": false
  },
  {
    "name": "Feta",
    "unit": "g",
    "unitQty": 200,
    "price": 2.6,
    "dept": "cremerie",
    "loose": false
  },
  {
    "name": "Bûche de chèvre",
    "unit": "pièce",
    "unitQty": 1,
    "price": 2.5,
    "dept": "cremerie",
    "loose": false
  },
  {
    "name": "Comté",
    "unit": "g",
    "unitQty": 250,
    "price": 5.5,
    "dept": "cremerie",
    "loose": false
  },
  {
    "name": "Mascarpone",
    "unit": "g",
    "unitQty": 250,
    "price": 2.4,
    "dept": "cremerie",
    "loose": false
  },
  {
    "name": "Fromage blanc",
    "unit": "g",
    "unitQty": 1000,
    "price": 2.9,
    "dept": "cremerie",
    "loose": false
  },
  {
    "name": "Pâte feuilletée",
    "unit": "pièce",
    "unitQty": 1,
    "price": 1.3,
    "dept": "cremerie",
    "loose": false
  },
  {
    "name": "Pâte brisée",
    "unit": "pièce",
    "unitQty": 1,
    "price": 1.2,
    "dept": "cremerie",
    "loose": false
  },
  {
    "name": "Pâte à pizza",
    "unit": "pièce",
    "unitQty": 1,
    "price": 1.4,
    "dept": "cremerie",
    "loose": false
  },
  {
    "name": "Riz",
    "unit": "g",
    "unitQty": 1000,
    "price": 2.2,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Riz basmati",
    "unit": "g",
    "unitQty": 1000,
    "price": 3.2,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Pâtes",
    "unit": "g",
    "unitQty": 500,
    "price": 1.1,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Spaghetti",
    "unit": "g",
    "unitQty": 500,
    "price": 1.2,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Vermicelles de riz",
    "unit": "g",
    "unitQty": 400,
    "price": 2.8,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Nouilles",
    "unit": "g",
    "unitQty": 250,
    "price": 2.2,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Semoule",
    "unit": "g",
    "unitQty": 500,
    "price": 1.4,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Lentilles",
    "unit": "g",
    "unitQty": 500,
    "price": 1.9,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Lentilles corail",
    "unit": "g",
    "unitQty": 500,
    "price": 2.4,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Quinoa",
    "unit": "g",
    "unitQty": 500,
    "price": 3.5,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Pois chiches",
    "unit": "boîte",
    "unitQty": 1,
    "price": 0.95,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Haricots rouges",
    "unit": "boîte",
    "unitQty": 1,
    "price": 1,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Maïs",
    "unit": "boîte",
    "unitQty": 1,
    "price": 1.2,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Tomates concassées",
    "unit": "boîte",
    "unitQty": 1,
    "price": 0.95,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Concentré de tomates",
    "unit": "boîte",
    "unitQty": 1,
    "price": 0.9,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Sauce tomate",
    "unit": "g",
    "unitQty": 500,
    "price": 1.3,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Huile d'olive",
    "unit": "cl",
    "unitQty": 75,
    "price": 6.5,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Huile de tournesol",
    "unit": "l",
    "unitQty": 1,
    "price": 2.2,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Huile de sésame",
    "unit": "cl",
    "unitQty": 25,
    "price": 3.2,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Vinaigre balsamique",
    "unit": "cl",
    "unitQty": 25,
    "price": 2.5,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Vinaigre de vin",
    "unit": "cl",
    "unitQty": 75,
    "price": 1.5,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Sauce soja",
    "unit": "cl",
    "unitQty": 15,
    "price": 2.3,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Nuoc-mâm",
    "unit": "cl",
    "unitQty": 20,
    "price": 2.9,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Moutarde",
    "unit": "pot",
    "unitQty": 1,
    "price": 1.8,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Mayonnaise",
    "unit": "pot",
    "unitQty": 1,
    "price": 2.5,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Ketchup",
    "unit": "pièce",
    "unitQty": 1,
    "price": 2.3,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Bouillon de volaille",
    "unit": "cube",
    "unitQty": 12,
    "price": 1.6,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Bouillon de légumes",
    "unit": "cube",
    "unitQty": 12,
    "price": 1.6,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Farine",
    "unit": "g",
    "unitQty": 1000,
    "price": 0.95,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Sel",
    "unit": "g",
    "unitQty": 500,
    "price": 0.6,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Poivre",
    "unit": "pot",
    "unitQty": 1,
    "price": 1.9,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Curry en poudre",
    "unit": "pot",
    "unitQty": 1,
    "price": 1.6,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Paprika",
    "unit": "pot",
    "unitQty": 1,
    "price": 1.5,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Cumin",
    "unit": "pot",
    "unitQty": 1,
    "price": 1.6,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Curcuma",
    "unit": "pot",
    "unitQty": 1,
    "price": 1.7,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Herbes de Provence",
    "unit": "pot",
    "unitQty": 1,
    "price": 1.5,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Noix de muscade",
    "unit": "pot",
    "unitQty": 1,
    "price": 2.2,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Cannelle",
    "unit": "pot",
    "unitQty": 1,
    "price": 1.6,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Piment d'Espelette",
    "unit": "pot",
    "unitQty": 1,
    "price": 3.5,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Lait de coco",
    "unit": "cl",
    "unitQty": 40,
    "price": 1.9,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Olives",
    "unit": "g",
    "unitQty": 160,
    "price": 1.8,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Câpres",
    "unit": "pot",
    "unitQty": 1,
    "price": 1.6,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Cornichons",
    "unit": "pot",
    "unitQty": 1,
    "price": 2.3,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Cacahuètes",
    "unit": "g",
    "unitQty": 250,
    "price": 1.9,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Amandes",
    "unit": "g",
    "unitQty": 200,
    "price": 3.2,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Noix",
    "unit": "g",
    "unitQty": 125,
    "price": 2.8,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Pignons de pin",
    "unit": "g",
    "unitQty": 50,
    "price": 3.5,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Chapelure",
    "unit": "g",
    "unitQty": 250,
    "price": 1.2,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Levure chimique",
    "unit": "sachet",
    "unitQty": 6,
    "price": 0.9,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Levure boulangère",
    "unit": "sachet",
    "unitQty": 5,
    "price": 0.95,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Maïzena",
    "unit": "g",
    "unitQty": 250,
    "price": 1.5,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Miel",
    "unit": "pot",
    "unitQty": 1,
    "price": 3.5,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Pesto",
    "unit": "pot",
    "unitQty": 1,
    "price": 2.2,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Pâte de curry",
    "unit": "pot",
    "unitQty": 1,
    "price": 2.5,
    "dept": "epicerie",
    "loose": false
  },
  {
    "name": "Sucre",
    "unit": "g",
    "unitQty": 1000,
    "price": 1.2,
    "dept": "epicerie-sucree",
    "loose": false
  },
  {
    "name": "Sucre roux",
    "unit": "g",
    "unitQty": 500,
    "price": 1.7,
    "dept": "epicerie-sucree",
    "loose": false
  },
  {
    "name": "Sucre glace",
    "unit": "g",
    "unitQty": 500,
    "price": 1.5,
    "dept": "epicerie-sucree",
    "loose": false
  },
  {
    "name": "Sucre vanillé",
    "unit": "sachet",
    "unitQty": 10,
    "price": 1,
    "dept": "epicerie-sucree",
    "loose": false
  },
  {
    "name": "Chocolat noir",
    "unit": "g",
    "unitQty": 200,
    "price": 2.5,
    "dept": "epicerie-sucree",
    "loose": false
  },
  {
    "name": "Chocolat au lait",
    "unit": "g",
    "unitQty": 100,
    "price": 1.3,
    "dept": "epicerie-sucree",
    "loose": false
  },
  {
    "name": "Cacao en poudre",
    "unit": "g",
    "unitQty": 250,
    "price": 2.8,
    "dept": "epicerie-sucree",
    "loose": false
  },
  {
    "name": "Extrait de vanille",
    "unit": "pièce",
    "unitQty": 1,
    "price": 2.9,
    "dept": "epicerie-sucree",
    "loose": false
  },
  {
    "name": "Confiture",
    "unit": "pot",
    "unitQty": 1,
    "price": 2.2,
    "dept": "epicerie-sucree",
    "loose": false
  },
  {
    "name": "Compote",
    "unit": "pot",
    "unitQty": 1,
    "price": 2,
    "dept": "epicerie-sucree",
    "loose": false
  },
  {
    "name": "Pâte à tartiner",
    "unit": "pot",
    "unitQty": 1,
    "price": 3.5,
    "dept": "epicerie-sucree",
    "loose": false
  },
  {
    "name": "Biscuits cuillère",
    "unit": "g",
    "unitQty": 175,
    "price": 1.5,
    "dept": "epicerie-sucree",
    "loose": false
  },
  {
    "name": "Pépites de chocolat",
    "unit": "g",
    "unitQty": 100,
    "price": 1.6,
    "dept": "epicerie-sucree",
    "loose": false
  },
  {
    "name": "Baguette",
    "unit": "pièce",
    "unitQty": 1,
    "price": 1.1,
    "dept": "boulangerie",
    "loose": false
  },
  {
    "name": "Pain de mie",
    "unit": "pièce",
    "unitQty": 1,
    "price": 1.5,
    "dept": "boulangerie",
    "loose": false
  },
  {
    "name": "Pain burger",
    "unit": "pièce",
    "unitQty": 4,
    "price": 1.8,
    "dept": "boulangerie",
    "loose": false
  },
  {
    "name": "Tortillas",
    "unit": "pièce",
    "unitQty": 6,
    "price": 1.9,
    "dept": "boulangerie",
    "loose": false
  },
  {
    "name": "Petits pois surgelés",
    "unit": "g",
    "unitQty": 1000,
    "price": 2.2,
    "dept": "surgeles",
    "loose": false
  },
  {
    "name": "Épinards surgelés",
    "unit": "g",
    "unitQty": 750,
    "price": 2.1,
    "dept": "surgeles",
    "loose": false
  },
  {
    "name": "Frites surgelées",
    "unit": "g",
    "unitQty": 1000,
    "price": 2.5,
    "dept": "surgeles",
    "loose": false
  },
  {
    "name": "Glace vanille",
    "unit": "pièce",
    "unitQty": 1,
    "price": 3.5,
    "dept": "surgeles",
    "loose": false
  },
  {
    "name": "Poisson pané",
    "unit": "pièce",
    "unitQty": 10,
    "price": 3.9,
    "dept": "surgeles",
    "loose": false
  },
  {
    "name": "Nems",
    "unit": "pièce",
    "unitQty": 4,
    "price": 3.8,
    "dept": "surgeles",
    "loose": false
  },
  {
    "name": "Poêlée de légumes",
    "unit": "g",
    "unitQty": 750,
    "price": 2.6,
    "dept": "surgeles",
    "loose": false
  },
  {
    "name": "Eau gazeuse",
    "unit": "l",
    "unitQty": 1,
    "price": 0.6,
    "dept": "boissons",
    "loose": false
  },
  {
    "name": "Jus d'orange",
    "unit": "l",
    "unitQty": 1,
    "price": 1.6,
    "dept": "boissons",
    "loose": false
  },
  {
    "name": "Vin blanc de cuisine",
    "unit": "cl",
    "unitQty": 75,
    "price": 3.5,
    "dept": "boissons",
    "loose": false
  },
  {
    "name": "Vin rouge",
    "unit": "cl",
    "unitQty": 75,
    "price": 4,
    "dept": "boissons",
    "loose": false
  },
  {
    "name": "Papier cuisson",
    "unit": "pièce",
    "unitQty": 1,
    "price": 1.8,
    "dept": "autres",
    "loose": false
  }
]
