import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

function CreateViewer(container) {
    let viewer = new IfcViewerAPI({ container, backgroundColor: new Color(0xffffff) });
    viewer.axes.setAxes();
    viewer.grid.setGrid();

    return viewer;
}

// Mapeamento de Botões da UI
document.getElementById('create-plane').onclick = () => {
    viewer.clipper.createPlane();
};

document.getElementById('delete-plane').onclick = () => {
    viewer.clipper.deletePlane();
};

const container = document.getElementById('viewer-container');
let viewer = CreateViewer(container);
const input = document.getElementById("file-input");

window.onmousemove = () => viewer.IFC.selector.prePickIfcItem();
// Select items and log properties
window.ondblclick = async () => {
    const item = await viewer.IFC.selector.pickIfcItem(true);
    if (item.modelID === undefined || item.id === undefined) return;
    console.log(await viewer.IFC.getProperties(item.modelID, item.id, true));
}
viewer.clipper.active = true;

input.addEventListener("change",

    async (changed) => {

        const file = changed.target.files[0];
        const ifcURL = URL.createObjectURL(file);
        loadIfc(ifcURL);
    },

    false
);

// index.js

async function loadIfc(url) {
    await viewer.dispose();
    viewer = CreateViewer(container);
    
    // 💡 IMPORTANTE: O caminho DEVE ser o diretório /wasm/ e terminar com uma barra.
    await viewer.IFC.setWasmPath("/wasm/"); 
    
    const model = await viewer.IFC.loadIfcUrl(url);
    viewer.shadowDropper.renderShadow(model.modelID);
}

loadIfc('models/01.ifc');

// Mantendo o teclado:
window.onkeydown = (event) => {
    if (event.code === 'KeyP') {
        viewer.clipper.createPlane();
    }
    else if (event.code === 'KeyO') {
        viewer.clipper.deletePlane();
    }
    else if (event.code === 'Escape') {
        viewer.IFC.selector.unpickIfcItems();
    }
};