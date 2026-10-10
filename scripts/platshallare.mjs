// Platshållare i config.json: ett värde som ägaren ska byta ut, skrivet som PLATSHALLARE
// eller [inom hakparenteser]. Delas av webbläsaren (banderollen) och skripten (bygget).
export const arPlatshallare = (varde) => typeof varde === 'string' && /PLATSHALLARE|\[[^\]]*\]/.test(varde)

/** Saknas värdet helt, eller är det fortfarande en platshållare? */
export const saknasEllerPlatshallare = (varde) => !varde || arPlatshallare(varde)
