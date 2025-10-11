// index.js — versão compatível com web-ifc-viewer@1.0.218
import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

// --- VARIÁVEIS GLOBAIS ---
let viewer;
let currentModelID = -1;
let lastPickedItem = null;

// Aguarda o carregamento da página
document.addEventListener('DOMContentLoaded', () => {

    const container = document.getElementById('viewer-container');

    // --- Função para criar o viewer ---
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

    // --- Função para carregar IFC ---
    async function loadIfc(url) {
        if (viewer) await viewer.dispose();
        viewer = CreateViewer(container);

        // Caminho para o WebAssembly
        await viewer.IFC.setWasmPath("/wasm/");

        const model = await viewer.IFC.loadIfcUrl(url);
        currentModelID = model.modelID;

        viewer.shadowDropper.renderShadow(currentModelID);
        return model;
    }

    // --- Inicializa o Viewer com o modelo padrão ---
    viewer = CreateViewer(container);
    loadIfc('models/01.ifc');

    // --- Elementos de interface ---
    const input = document.getElementById("file-input");
    const hideSelectedButton = document.getElementById("hide-selected");
    const showAllButton = document.getElementById("show-all");

    // --- Upload de novo IFC ---
    if (input) {
        input.addEventListener("change", async (changed) => {
            const file = changed.target.files[0];
            const ifcURL = URL.createObjectURL(file);
            await loadIfc(ifcURL);
        }, false);
    }

    // =======================================================
    // 🔹 FUNÇÕES DE VISIBILIDADE (USANDO THREE.JS DIRETO)
    // =======================================================

    // Ocultar o item selecionado
    async function hideSelected() {
        if (!lastPickedItem || currentModelID === -1) {
            alert("Nenhum item selecionado. Dê um duplo clique para selecionar primeiro.");
            return;
        }

        const expressID = lastPickedItem.id;
        const scene = viewer.context.getScene();

        let hiddenCount = 0;

        scene.traverse((obj) => {
            if (obj.userData && obj.userData.expressID === expressID) {
                obj.visible = false;
                hiddenCount++;
            }
        });

        console.log(`🔹 ${hiddenCount} objeto(s) ocultado(s).`);
        viewer.IFC.selector.unpickIfcItems();
        lastPickedItem = null;
    }

    // Exibir todos os objetos novamente
    async function showAll() {
        const scene = viewer.context.getScene();
        let shownCount = 0;

        scene.traverse((obj) => {
            if (obj.userData && obj.userData.expressID != null) {
                obj.visible = true;
                shownCount++;
            }
        });

        console.log(`🔹 ${shownCount} objeto(s) exibido(s).`);
    }

    // Ligando botões às funções
    if (hideSelectedButton) hideSelectedButton.onclick = hideSelected;
    if (showAllButton) showAllButton.onclick = showAll;

    // =======================================================
    // 🔹 INTERAÇÕES DO USUÁRIO
    // =======================================================

    // Pré-seleção ao mover o mouse
    window.onmousemove = () => viewer.IFC.selector.prePickIfcItem();

    // Duplo clique → Seleciona e salva o item
    window.ondblclick = async () => {
        const item = await viewer.IFC.selector.pickIfcItem(true);

        if (!item || item.modelID === undefined || item.id === undefined) return;

        lastPickedItem = item;
        console.log("🟩 Item selecionado:", await viewer.IFC.getProperties(item.modelID, item.id, true));
    };

    // Atalhos de teclado
    window.onkeydown = (event) => {
        if (event.code === 'KeyP') {
            viewer.clipper.createPlane();
        } else if (event.code === 'KeyO') {
            viewer.clipper.deletePlane();
        } else if (event.code === 'Escape') {
            viewer.IFC.selector.unpickIfcItems();
            lastPickedItem = null;
        }
    };
});
