import { front, back, productById } from './catalog.js'

export const BOX_IMAGE = '/media/box-sealed.svg'
export const parcelImage = (line, face = 'front') => line.type === 'box' ? BOX_IMAGE : (face === 'back' ? back : front)(productById[line.ids[0]])
export const boxButton = line => '<button type="button" class="parcel-inspect" data-inspect-box="' + line.key + '" aria-label="Open box with ' + line.ids.length + ' pouches"><img src="' + BOX_IMAGE + '" alt="Sealed PanPops box"><span>Open box · ' + line.ids.length + ' pouches</span></button>'
export const inspectorTemplate = () => `<dialog class="parcel-dialog" data-box-dialog aria-labelledby="box-inspector-title"><button class="parcel-dialog-close" type="button" data-close-box>Close</button><h2 id="box-inspector-title">Inside your box</h2><p data-box-inspector-count></p><div class="parcel-open-stage"><div class="parcel-open-lid"><img src="/media/logo.png" alt="PanPops"></div><div class="parcel-open-contents" data-box-inspector-contents></div></div><p class="parcel-inspector-note">Your pouches stay packed together as one box.</p></dialog>`
