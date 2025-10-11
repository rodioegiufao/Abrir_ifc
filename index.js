import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

let viewer;
let currentModelID = -1;
let lastPickedItem = null;
let visibleSubset = null; // armazenará o subset atual visível
let originalMaterial = null; // 🔴 NOVO: Para armazenar o material do modelo original

document.addEventListener('DOMContentLoaded', () => {

    const container = document.getElementById('viewer-container');

    // --- Cria o viewer ---
    function CreateViewer(container) {
        const newViewer = new IfcViewerAPI({
            container,
            backgroundColor: new Color(0xeeeeee)
        });
        newViewer.axes.setAxes();
        newViewer.grid.setGrid();
        newViewer.clipper.active = true;
        return newViewer;
    }

    // --- Lógica de Ocultar/Exibir ---

    // 1. Oculta o item selecionado (remove do subset visível)
    function hideSelected() {
        if (!lastPickedItem || currentModelID === -1) {
            alert("Nenhum item selecionado. Dê um duplo clique para selecionar primeiro.");
            return;
        }

        // 🟢 CORREÇÃO: Remove o item do subset existente
        viewer.IFC.loader.ifcManager.removeFromSubset(
            visibleSubset.geometry.attributes.expressID.array, 
            lastPickedItem.id, 
            currentModelID, 
            "visibleSubset"
        );

        console.log(`🔹 Item ${lastPickedItem.id} ocultado.`);
        viewer.IFC.selector.unpickIfcItems();
        lastPickedItem = null;
    }

    // 2. Exibe todos os elementos (recria o subset com todos os IDs)
    async function showAll() {
        if (currentModelID === -1) return;

        // Pega todos os IDs novamente
        const ids = await viewer.IFC.loader.ifcManager.getAllItemsOfType(
            currentModelID,
            null,
            false
        );

        // Remove o subset antigo, se existir
        viewer.context.getScene().remove(visibleSubset);

        // Recria o subset com todos os IDs e o material ORIGINAL
        visibleSubset = viewer.IFC.loader.ifcManager.createSubset({
            modelID: currentModelID,
            ids: ids,
            removePrevious: true,
            customID: "visibleSubset",
            // 🔴 CORREÇÃO APLICADA AQUI
            material: originalMaterial 
        });

        console.log(`🔹 Todos os elementos foram exibidos novamente.`);
    }

    // --- Carrega IFC ---
    async function loadIfc(url) {
        if (viewer) await viewer.dispose();
        viewer = CreateViewer(container);

        await viewer.IFC.setWasmPath("/wasm/");
        const model = await viewer.IFC.loadIfcUrl(url);
        currentModelID = model.modelID;

        // 🔴 NOVO: Extrai o material do modelo original ANTES de escondê-lo
        // Nota: O material está no primeiro elemento do array 'materials' do Mesh
        originalMaterial = model.mesh.material[0]; 

        // 🔸 Oculta o modelo original (a geometria completa)
        model.mesh.visible = false;

        // 🔸 Cria o subset visível inicial com todos os elementos e o material ORIGINAL
        const ids = await viewer.IFC.loader.ifcManager.getAllItemsOfType(
            currentModelID,
            null,
            false
        );

        visibleSubset = viewer.IFC.loader.ifcManager.createSubset({
            modelID: currentModelID,
            ids: ids,
            removePrevious: true,
            customID: "visibleSubset",
            // 🔴 CORREÇÃO APLICADA AQUI
            material: originalMaterial 
        });

        viewer.shadowDropper.renderShadow(currentModelID);
    }

    // --- Inicialização e Event Listeners ---
    viewer = CreateViewer(container);
    loadIfc('models/01.ifc');

    const input = document.getElementById("file-input");
    const hideSelectedButton = document.getElementById('hide-selected');
    const showAllButton = document.getElementById('show-all');

    if (input) {
        input.addEventListener("change", async (changed) => {
            const file = changed.target.files[0];
            const ifcURL = URL.createObjectURL(file);
            await loadIfc(ifcURL);
        }, false);
    }

    // Mapeamento de botões (assumindo que você tem hide-selected e show-all no HTML)
    if (hideSelectedButton) hideSelectedButton.onclick = hideSelected;
    if (showAllButton) showAllButton.onclick = showAll;

    // =======================================================
    // 🔹 INTERAÇÕES DE SELEÇÃO
    // =======================================================
    window.onmousemove = () => viewer.IFC.selector.prePickIfcItem();

    window.ondblclick = async () => {
        const item = await viewer.IFC.selector.pickIfcItem(true);
        if (!item || item.modelID === undefined || item.id === undefined) return;
        lastPickedItem = item;
        console.log("🟩 Item selecionado:", await viewer.IFC.getProperties(item.modelID, item.id, true));
    };

    // Atalhos do teclado
    window.onkeydown = (event) => {
        if (event.code === 'KeyP') viewer.clipper.createPlane();
        else if (event.code === 'KeyO') viewer.clipper.deletePlane();
        else if (event.code === 'Escape') {
            viewer.IFC.selector.unpickIfcItems();
            lastPickedItem = null;
        }
    };
});