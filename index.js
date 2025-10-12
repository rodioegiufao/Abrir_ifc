import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

let viewer;
let currentModelID = -1;
let lastPickedItem = null;

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

    // --- Carrega um IFC ---
    async function loadIfc(url) {
        if (viewer) await viewer.dispose();
        viewer = CreateViewer(container);
        await viewer.IFC.setWasmPath("/wasm/");
        const model = await viewer.IFC.loadIfcUrl(url);
        currentModelID = model.modelID;

        // Aguarda o carregamento completo
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Cria subset visível
        await createVisibleSubset();
        
        viewer.shadowDropper.renderShadow(currentModelID);
        return model;
    }

    // --- Cria subset visível com todos os elementos ---
    async function createVisibleSubset() {
        if (currentModelID === -1) return;
        
        try {
            console.log("🔹 Criando subset visível...");
            
            // Método DIRETO: obtém TODOS os elementos do modelo
            // O tipo 1 geralmente representa IfcRoot, que é base para quase tudo
            const allIds = await viewer.IFC.loader.ifcManager.getAllItemsOfType(
                currentModelID,
                1, // IfcRoot - deve pegar a maioria dos elementos
                false
            );
            
            console.log(`🔹 Encontrados ${allIds.length} elementos`);
            
            // Se não encontrou muitos elementos, tenta outros tipos comuns
            if (allIds.length < 10) {
                console.log("🔹 Poucos elementos encontrados, tentando tipos específicos...");
                
                const additionalTypes = [2, 3, 4, 5, 106, 108, 109, 110, 111, 112, 113];
                let additionalIds = [];
                
                for (const type of additionalTypes) {
                    try {
                        const ids = await viewer.IFC.loader.ifcManager.getAllItemsOfType(
                            currentModelID,
                            type,
                            false
                        );
                        additionalIds = [...additionalIds, ...ids];
                        console.log(`🔹 Tipo ${type}: ${ids.length} elementos`);
                    } catch (e) {
                        // Tipo não existe, continua
                    }
                }
                
                // Combina todos os IDs, removendo duplicatas
                const combinedIds = [...new Set([...allIds, ...additionalIds])];
                console.log(`🔹 Total combinado: ${combinedIds.length} elementos`);
                
                viewer.IFC.loader.ifcManager.createSubset({
                    modelID: currentModelID,
                    ids: combinedIds,
                    removePrevious: true,
                    customID: "visibleSubset"
                });
            } else {
                // Usa os IDs encontrados
                viewer.IFC.loader.ifcManager.createSubset({
                    modelID: currentModelID,
                    ids: allIds,
                    removePrevious: true,
                    customID: "visibleSubset"
                });
            }
            
            console.log("✅ Subset visível criado com sucesso");
            
        } catch (error) {
            console.error("❌ Erro ao criar subset:", error);
            
            // Método de emergência: tenta criar subset vazio e adicionar gradualmente
            await emergencySubsetCreation();
        }
    }

    // --- Método de emergência para criação de subset ---
    async function emergencySubsetCreation() {
        console.log("🔹 Usando método de emergência para subset...");
        
        try {
            // Cria um subset vazio primeiro
            viewer.IFC.loader.ifcManager.createSubset({
                modelID: currentModelID,
                ids: [],
                removePrevious: true,
                customID: "visibleSubset"
            });
            
            // Tenta adicionar elementos gradualmente por tipos conhecidos
            const commonTypes = [
                1, 2, 3, 4, 5,    // Estrutura organizacional
                106, 108, 109, 110, 111, 112, 113, // Elementos de construção
                115, 116, 117, 118, 119, 120 // Mais tipos comuns
            ];
            
            for (const type of commonTypes) {
                try {
                    const ids = await viewer.IFC.loader.ifcManager.getAllItemsOfType(
                        currentModelID,
                        type,
                        false
                    );
                    
                    if (ids.length > 0) {
                        viewer.IFC.loader.ifcManager.addToSubset(
                            currentModelID,
                            ids,
                            "visibleSubset"
                        );
                        console.log(`🔹 Adicionados ${ids.length} elementos do tipo ${type}`);
                    }
                } catch (e) {
                    // Ignora erros de tipos não encontrados
                }
            }
            
        } catch (error) {
            console.error("❌ Método de emergência também falhou:", error);
        }
    }

    // --- Inicializa ---
    viewer = CreateViewer(container);
    loadIfc('models/01.ifc');

    const input = document.getElementById("file-input");
    const hideSelectedButton = document.getElementById("hide-selected");
    const showAllButton = document.getElementById("show-all");

    // --- Upload manual ---
    if (input) {
        input.addEventListener("change", async (changed) => {
            const file = changed.target.files[0];
            const ifcURL = URL.createObjectURL(file);
            await loadIfc(ifcURL);
        }, false);
    }

    // =======================================================
    // 🔹 CONTROLE DE VISIBILIDADE CORRIGIDO
    // =======================================================

    async function hideSelected() {
        if (!lastPickedItem || currentModelID === -1) {
            alert("Nenhum item selecionado. Dê um duplo clique para selecionar primeiro.");
            return;
        }

        const expressID = lastPickedItem.id;
        console.log(`🔹 Tentando ocultar item ${expressID}`);

        try {
            // Remove o item do subset visível
            viewer.IFC.loader.ifcManager.removeFromSubset(
                currentModelID,
                [expressID],
                "visibleSubset"
            );

            console.log(`✅ Item ${expressID} ocultado com sucesso.`);
            
        } catch (error) {
            console.error("❌ Erro ao ocultar item:", error);
            alert("Erro ao ocultar item. Verifique o console.");
        }
        
        viewer.IFC.selector.unpickIfcItems();
        viewer.IFC.selector.unHighlightIfcItems();
        lastPickedItem = null;
    }

    async function showAll() {
        if (currentModelID === -1) return;

        console.log("🔹 Restaurando visibilidade de todos os elementos...");
        
        await createVisibleSubset();
        console.log(`✅ Todos os elementos foram exibidos novamente.`);
    }

    if (hideSelectedButton) hideSelectedButton.onclick = hideSelected;
    if (showAllButton) showAllButton.onclick = showAll;

    // =======================================================
    // 🔹 INTERAÇÕES DE SELEÇÃO (CORRIGIDAS)
    // =======================================================
    
    // IMPORTANTE: Corrigindo o problema de seleção que oculta outros elementos
    window.onmousemove = () => {
        if (viewer && viewer.IFC && viewer.IFC.selector) {
            viewer.IFC.selector.prePickIfcItem();
        }
    };

    window.ondblclick = async (event) => {
        // Previne comportamento padrão que pode interferir
        event.preventDefault();
        event.stopPropagation();
        
        if (!viewer || !viewer.IFC || !viewer.IFC.selector) return;
        
        const item = await viewer.IFC.selector.pickIfcItem(true);
        if (!item || item.modelID === undefined || item.id === undefined) {
            console.log("Nenhum item IFC selecionado");
            return;
        }
        
        lastPickedItem = item;
        
        // Apenas destaca, NÃO modifica subsets
        viewer.IFC.selector.highlightIfcItem(item, false);
        
        const props = await viewer.IFC.getProperties(item.modelID, item.id, true);
        console.log("🟩 Item selecionado:", props);
    };

    // Atalhos do teclado
    window.onkeydown = (event) => {
        if (event.code === 'KeyP') {
            viewer.clipper.createPlane();
        } else if (event.code === 'KeyO') {
            viewer.clipper.deletePlane();
        } else if (event.code === 'Escape') {
            viewer.IFC.selector.unpickIfcItems();
            viewer.IFC.selector.unHighlightIfcItems();
            lastPickedItem = null;
        } else if (event.code === 'KeyH' && !event.ctrlKey) {
            // Atalho para ocultar (H)
            event.preventDefault();
            hideSelected();
        } else if (event.code === 'KeyS' && !event.ctrlKey) {
            // Atalho para mostrar tudo (S)
            event.preventDefault();
            showAll();
        }
    };
});