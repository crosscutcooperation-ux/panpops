import { front, back, productById } from './catalog.js'

export const BOX_IMAGE = '/media/box-sealed.svg'
export const parcelImage = (line, face = 'front') => line.type === 'box' ? BOX_IMAGE : (face === 'back' ? back : front)(productById[line.ids[0]])
export const boxButton = line => '<button type="button" class="parcel-inspect" data-inspect-box="' + line.key + '" aria-label="View selection of ' + line.ids.length + ' pouches"><img src="' + BOX_IMAGE + '" alt="Illustrative PanPops box"><span>View mix · ' + line.ids.length + ' pouches</span></button>'
export const inspectorTemplate = () => `<dialog class="parcel-dialog" data-box-dialog aria-labelledby="box-inspector-title"><button class="parcel-dialog-close" type="button" data-close-box>Close</button><h2 id="box-inspector-title">Your pouch selection</h2><p data-box-inspector-count></p><div class="parcel-open-stage"><div class="parcel-open-lid"><img src="/media/logo.png" alt="PanPops"></div><div class="parcel-open-contents" data-box-inspector-contents></div></div><p class="parcel-inspector-note">The box shown is for visual demonstration only. Your order includes the selected pouches; a physical box is not included.</p></dialog>`
