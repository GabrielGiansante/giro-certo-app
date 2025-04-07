// ========================================================================
// Rota Fácil - script.js
// VERSÃO DE TESTE 2: Reintroduzindo Seta e WatchPosition
// ========================================================================

// Variáveis globais (incluindo as da seta e watchId)
let map;
let placesService;
let directionsService = null; // Ainda não reintroduzido
let directionsRenderer = null; // Ainda não reintroduzido
// const markers = []; // Ainda não reintroduzido
let foundMarkers = []; // Usado apenas para LOGAR resultados por enquanto
let currentUserLocation = null;
let userLocationMarker = null; // Variável da Seta
let userLocationAccuracyCircle = null; // Variável do Círculo
let watchId = null; // Variável do Watcher
// Variáveis de Recálculo (ainda não usadas nesta versão)
let currentRouteResult = null;
let currentRouteRequest = null;
let isRecalculating = false;
const ROUTE_DEVIATION_TOLERANCE = 50;
// let selectedPlaceData = null; // Autocomplete ainda não reintroduzido
// Referência ao container principal (para modo mapa)
let appContainer = null; // Ainda não usado nesta versão

// --- Reset Inicial do Watcher (GARANTIDO) ---
if (navigator.geolocation && typeof watchId !== 'undefined' && watchId !== null) {
     console.log(">>> Reset Inicial: Tentando limpar watchId pré-existente:", watchId);
     try { // Adiciona try-catch para clearWatch
          navigator.geolocation.clearWatch(watchId);
          console.log(">>> Reset Inicial: clearWatch executado para watchId:", watchId);
     } catch (e) {
          console.error(">>> Reset Inicial: Erro ao executar clearWatch:", e);
     }
     watchId = null; // Define como null DEPOIS de tentar limpar
} else {
     console.log(">>> Reset Inicial: Nenhum watchId pré-existente ou inválido encontrado para limpar.");
     watchId = null; // Garante que seja null se não entrou no if
}
// Garante que watchId seja ABSOLUTAMENTE null ao iniciar o script, independentemente do que aconteceu acima
watchId = null;
console.log(">>> Reset Inicial: Estado final GARANTIDO de watchId:", watchId);
// --------------------------------------------


/**
 * Cria ou atualiza o marcador de seta e círculo de precisão do usuário.
 * Chamada por getCurrentPosition e watchPosition.
 */
function updateUserMarkerAndAccuracy(position) {
    console.log(">>> updateUserMarkerAndAccuracy: INÍCIO DA FUNÇÃO. Dados recebidos:", position ? position.coords : 'null');

    if (!position || !position.coords) {
         console.warn(">>> updateUserMarkerAndAccuracy: Posição inválida recebida. Abortando.");
         return;
    }

    const pos = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
    };
    const accuracy = position.coords.accuracy;
    const heading = position.coords.heading;

    // Verifica se o mapa existe e é um objeto válido do Google Maps
    if (!map || typeof map.setCenter !== 'function') { // Checa se 'map' é um objeto de mapa válido
        console.error(">>> updateUserMarkerAndAccuracy: ERRO - A variável 'map' não é um objeto de mapa válido!");
        return;
    }
    console.log(">>> updateUserMarkerAndAccuracy: Variável 'map' OK. Verificando círculo...");

    // --- Círculo de Precisão ---
    try { // try-catch para operações do círculo
        if (userLocationAccuracyCircle) {
            userLocationAccuracyCircle.setCenter(pos);
            userLocationAccuracyCircle.setRadius(accuracy);
        } else {
            userLocationAccuracyCircle = new google.maps.Circle({
                strokeColor: '#1a73e8', strokeOpacity: 0.4, strokeWeight: 1,
                fillColor: '#1a73e8', fillOpacity: 0.1, map: map,
                center: pos, radius: accuracy, zIndex: 1
            });
        }
        console.log(">>> updateUserMarkerAndAccuracy: Círculo OK.");
    } catch(circleError) {
        console.error("!!! ERRO ao criar/atualizar Círculo de Precisão:", circleError);
    }


    console.log(">>> updateUserMarkerAndAccuracy: Preparando ícone da seta...");
    // --- Marcador de Seta ---
    let iconConfig = {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, fillColor: '#1a73e8', fillOpacity: 1,
        strokeColor: '#ffffff', strokeWeight: 2, scale: 6, anchor: new google.maps.Point(0, 2), rotation: 0
    };

    if (heading !== null && !isNaN(heading) && typeof heading === 'number') {
        iconConfig.rotation = heading;
        console.log(`>>> updateUserMarkerAndAccuracy: Usando rotação ${heading} para a seta.`);
    } else {
        console.log(">>> updateUserMarkerAndAccuracy: Sem rotação válida para a seta.");
    }

    try { // try-catch para operações do marcador
        if (userLocationMarker) {
            console.log(">>> updateUserMarkerAndAccuracy: Atualizando seta existente...");
            userLocationMarker.setPosition(pos);
            userLocationMarker.setIcon(iconConfig);
            if(userLocationMarker.getMap() == null) { // Garante que está no mapa
                 console.warn(">>> updateUserMarkerAndAccuracy: Marcador existente não estava no mapa, readicionando.");
                 userLocationMarker.setMap(map);
            }
            console.log(">>> updateUserMarkerAndAccuracy: Seta existente ATUALIZADA.");
        } else {
            console.log(">>> updateUserMarkerAndAccuracy: Criando NOVA seta...");
            userLocationMarker = new google.maps.Marker({
                 position: pos, map: map, title: 'Sua localização atual', icon: iconConfig, zIndex: 2
            });
             console.log(">>> updateUserMarkerAndAccuracy: NOVA seta CRIADA com sucesso.");
        }
    } catch (markerError) {
        console.error("!!! ERRO ao criar/atualizar Marcador (Seta):", markerError);
        // Se falhou ao criar, garante que a variável fique null para tentar de novo
        if (!userLocationMarker) { userLocationMarker = null; }
    }


    currentUserLocation = pos; // Atualiza localização global
    console.log(">>> updateUserMarkerAndAccuracy: Variável currentUserLocation atualizada.");

    // --- Verificação de Desvio de Rota (AINDA DESATIVADA NESTA VERSÃO) ---
    // if (currentRouteResult && !isRecalculating && currentUserLocation && currentRouteRequest) { ... }

    console.log(">>> updateUserMarkerAndAccuracy: FIM DA FUNÇÃO.");
}

/**
 * Lida com erros da API de Geolocalização.
 */
function handleLocationError(error, isWatching) {
    let prefix = isWatching ? 'Erro ao monitorar localização' : 'Erro ao obter localização inicial';
    let message = `${prefix}: `;
    switch(error.code) {
       case error.PERMISSION_DENIED: message += "Permissão de localização negada."; break;
       case error.POSITION_UNAVAILABLE: message += "Localização indisponível."; break;
       case error.TIMEOUT: message += "Tempo limite esgotado."; break;
       default: message += `Erro desconhecido (código ${error.code}).`; break;
    }
    console.warn(message, error);

    // Limpa watcher e marcador se a permissão for negada durante o monitoramento
    if (isWatching && error.code === error.PERMISSION_DENIED) {
       if (userLocationMarker) { userLocationMarker.setMap(null); userLocationMarker = null; }
       if (userLocationAccuracyCircle) { userLocationAccuracyCircle.setMap(null); userLocationAccuracyCircle = null; }
       if (watchId !== null) {
            try { navigator.geolocation.clearWatch(watchId); } catch(e) { console.error("Erro ao limpar watchId em handleLocationError:", e); }
            watchId = null;
            console.log("Monitoramento (watchId) parado por negação de permissão.");
       }
    }
}


/**
 * Função de Callback principal chamada pela API do Google Maps.
 */
function initMap() {
    console.log(">>> initMap: Iniciando...");

    if (navigator.geolocation) {
        console.log(">>> initMap: Tentando obter localização inicial...");
        navigator.geolocation.getCurrentPosition(
            (position) => { // SUCESSO INICIAL
                console.log(">>> initMap: Localização inicial OBTIDA:", position.coords.latitude, position.coords.longitude);
                currentUserLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
                initializeMapAndServices(currentUserLocation, 15); // Inicializa o mapa com coords
                // >>> CHAMA A FUNÇÃO DA SETA <<<
                updateUserMarkerAndAccuracy(position); // REATIVADA
                // >>> CHAMA O WATCHER <<<
                startWatchingPosition(); // REATIVADA
            },
            (error) => { // ERRO INICIAL
                console.warn(">>> initMap: Erro ao obter localização inicial:", error.code, error.message);
                currentUserLocation = null;
                const defaultCoords = { lat: -23.5505, lng: -46.6333 };
                initializeMapAndServices(defaultCoords, 13); // Inicializa mapa com SP
                handleLocationError(error, false); // Chama o handler de erro
                // >>> CHAMA O WATCHER MESMO ASSIM <<<
                startWatchingPosition(); // REATIVADA
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 } // Opções getCurrentPosition
        );
    } else { // Navegador não suporta geolocalização
        currentUserLocation = null;
        console.warn(">>> initMap: Geolocalização não suportada. Usando São Paulo.");
        alert("Seu navegador não suporta Geolocalização.");
        const defaultCoords = { lat: -23.5505, lng: -46.6333 };
        initializeMapAndServices(defaultCoords, 13); // Inicializa mapa com SP
    }
}

/**
 * Função separada para iniciar o watchPosition. (Reintroduzida)
 */
function startWatchingPosition() {
     if (!navigator.geolocation) {
          console.warn("startWatchingPosition: Geolocalização não suportada, impossível monitorar.");
          return;
     }
     // Limpa qualquer watcher anterior ANTES de iniciar um novo (precaução extra)
     if (watchId !== null) {
          console.warn("startWatchingPosition: Limpando watchId existente antes de iniciar novo:", watchId);
          try { navigator.geolocation.clearWatch(watchId); } catch(e) { console.error("startWatchingPosition: Erro ao limpar watchId anterior:", e); }
          watchId = null;
     }

     console.log(">>> Tentando iniciar watchPosition...");
     try { // try-catch para o watchPosition em si
         watchId = navigator.geolocation.watchPosition(
             (newPosition) => { // Callback de SUCESSO do watchPosition
                 console.log("--- watchPosition Callback: Sucesso! Dados:", newPosition.coords.latitude, newPosition.coords.longitude);
                 if (newPosition && newPosition.coords) {
                     console.log("--- watchPosition Callback: Posição válida, chamando updateUserMarkerAndAccuracy.");
                     updateUserMarkerAndAccuracy(newPosition);
                 } else {
                     console.warn("--- watchPosition Callback: Recebeu nova posição, mas dados inválidos.", newPosition);
                 }
             },
             (error) => { // Callback de ERRO do watchPosition
                 console.error("!!! watchPosition Callback: ERRO recebido:", error.code, error.message);
                 handleLocationError(error, true); // Chama a função que trata o erro (e pode parar o watch)
             },
             // Opções do watchPosition
             { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
         );
         console.log(`>>> watchPosition chamado. watchId resultante: ${watchId}`);
     } catch (watchError) {
         console.error("!!! ERRO GERAL ao tentar iniciar watchPosition:", watchError);
         watchId = null; // Garante que watchId seja null se falhar ao iniciar
     }
 }


/**
 * Inicializa o mapa e os serviços essenciais (Places).
 */
function initializeMapAndServices(initialCoords, initialZoom) {
    console.log(">>> initializeMapAndServices: Iniciando com coords:", initialCoords);
    const mapDiv = document.getElementById('map-container');
    if (!mapDiv) { console.error("!!! ERRO CRÍTICO: #map-container não encontrado!"); return; }
    const loadingP = mapDiv.querySelector('p');
    if (loadingP) loadingP.remove();

    try {
        console.log(">>> initializeMapAndServices: Criando mapa...");
        map = new google.maps.Map(mapDiv, { center: initialCoords, zoom: initialZoom, mapId: "DEMO_MAP_ID" });
        console.log(">>> initializeMapAndServices: Mapa criado. Criando PlacesService...");

        placesService = new google.maps.places.PlacesService(map);
        console.log(">>> initializeMapAndServices: PlacesService criado.");

        // AINDA NÃO inicializa Directions aqui nesta versão de teste
        // directionsService = new google.maps.DirectionsService();
        // directionsRenderer = new google.maps.DirectionsRenderer({ map: map, suppressMarkers: false });

        console.log(">>> initializeMapAndServices: Serviços essenciais prontos.");
        setupCategoryListeners(); // Configura SOMENTE categorias

        // Marcador simples foi REMOVIDO daqui

    } catch (error) {
        console.error("!!! ERRO ao inicializar mapa ou PlacesService:", error);
        if (mapDiv) { mapDiv.innerHTML = `<p style="color: red; padding: 20px; font-weight: bold;">ERRO: ${error.message}</p>`; }
    }
}

/**
 * Configura SOMENTE os listeners dos botões de categoria.
 */
function setupCategoryListeners() {
    console.log(">>> setupCategoryListeners: Configurando...");
    const categoryButtons = document.querySelectorAll('.category-btn');
    const routeFoundBtn = document.getElementById('route-found-btn'); // Pega o botão traçar rota para desabilitar/habilitar

    if (!categoryButtons || categoryButtons.length === 0) {
        console.error("!!! ERRO: Nenhum botão de categoria (.category-btn) encontrado!");
        return;
    }
    if (!routeFoundBtn) {
         console.warn("AVISO: Botão #route-found-btn não encontrado, não será habilitado pela busca.");
    }

    categoryButtons.forEach(button => {
        button.addEventListener('click', function() {
            const categoryType = this.dataset.category;
            console.log(`>>> CATEGORIA CLICADA: "${categoryType}" <<<`);

            // Verifica mapa e placesService
            if (!map || !placesService || typeof placesService.nearbySearch !== 'function') { // Verifica se placesService é válido
                alert("Mapa ou serviço Places não está pronto!");
                console.error("Busca categoria: Mapa ou PlacesService inválido/indisponível.");
                return;
            }

            console.log(`--- Iniciando busca SIMPLIFICADA para "${categoryType}" ---`);
            // Desabilita botão Traçar Rota ANTES da busca
            if(routeFoundBtn) routeFoundBtn.disabled = true;
            // Limpa marcadores anteriores (usando a função corrigida)
            clearFoundMarkers();

            let request;
            if (currentUserLocation) { // Prioriza busca próxima
                 console.log("--- Buscando perto da localização atual ---");
                request = { location: currentUserLocation, radius: 5000, keyword: categoryType };
                placesService.nearbySearch(request, handleSimplifiedSearchResults);
            } else { // Busca na área visível se não tem localização
                console.log("--- Buscando na área visível do mapa ---");
                 if (!map.getBounds()) { alert("Área do mapa não definida."); return; }
                request = { bounds: map.getBounds(), query: categoryType };
                placesService.textSearch(request, handleSimplifiedSearchResults);
            }
        });
    });
    console.log(">>> setupCategoryListeners: Concluído.");
}

/**
 * Callback SIMPLIFICADO para a busca: APENAS LOGA os resultados e adiciona marcadores SIMPLES.
 */
function handleSimplifiedSearchResults(results, status) {
    console.log(`>>> handleSimplifiedSearchResults: Status recebido: "${status}"`);
    const routeFoundBtn = document.getElementById('route-found-btn'); // Pega o botão de novo

    // Limpa marcadores anteriores ANTES de adicionar novos (redundante mas seguro)
    clearFoundMarkers();

    if (status === google.maps.places.PlacesServiceStatus.OK) {
        console.log(`>>> handleSimplifiedSearchResults: SUCESSO! ${results ? results.length : 0} resultados encontrados.`);
        if (results && results.length > 0) {
            let bounds = new google.maps.LatLngBounds();
            let validCount = 0;
            results.forEach((place, index) => {
                if (place.name && place.geometry && place.geometry.location) {
                    console.log(`   - Resultado ${index + 1}: ${place.name} (${place.geometry.location.lat()}, ${place.geometry.location.lng()})`);
                    // Adiciona marcador simples para este teste
                    try {
                         const marker = new google.maps.Marker({
                              position: place.geometry.location,
                              map: map,
                              title: place.name
                         });
                         foundMarkers.push(marker); // Guarda referência para limpar depois
                         bounds.extend(place.geometry.location);
                         validCount++;
                    } catch(e) { console.error(`Erro ao criar marcador para ${place.name}:`, e); }
                } else {
                     console.log(`   - Resultado ${index + 1}: (Nome ou localização inválida)`);
                }
            });

            if (validCount > 0) {
                 console.log(`>>> handleSimplifiedSearchResults: ${validCount} marcadores adicionados ao mapa.`);
                 if (currentUserLocation) bounds.extend(currentUserLocation); // Inclui usuário no zoom
                 map.fitBounds(bounds); // Ajusta o mapa
                 if (map.getZoom() > 16) map.setZoom(16); // Limita zoom

                 // Habilita o botão Traçar Rota (mesmo que ele não faça nada ainda)
                 if (routeFoundBtn) routeFoundBtn.disabled = false;
                 console.log(">>> handleSimplifiedSearchResults: Botão Traçar Rota HABILITADO (funcionalidade ainda desativada).");

            } else {
                 console.warn(">>> handleSimplifiedSearchResults: Status OK, mas nenhum resultado com localização válida.");
                 alert("Busca OK, mas nenhum resultado com localização encontrado.");
                 if (routeFoundBtn) routeFoundBtn.disabled = true;
            }

        } else {
             console.log(">>> handleSimplifiedSearchResults: Status OK, mas array de resultados vazio ou inválido.");
             alert("Busca OK, mas nenhum resultado encontrado.");
             if (routeFoundBtn) routeFoundBtn.disabled = true;
        }
    } else { // Erro na busca
        console.error(`!!! handleSimplifiedSearchResults: Erro na busca! Status: "${status}"`);
        alert(`Erro ao buscar locais: ${status}. Verifique o console e a chave da API/limites.`);
        if (routeFoundBtn) routeFoundBtn.disabled = true;
    }
    console.log(">>> handleSimplifiedSearchResults: FIM.");
}


/**
 * Limpa marcadores encontrados e desabilita botão Traçar Rota.
 * (Função chamada ANTES de cada nova busca por categoria)
 */
function clearFoundMarkers() {
    console.log(`>>> clearFoundMarkers: Iniciando limpeza. ${foundMarkers ? `Array existe com ${foundMarkers.length} itens.` : 'Array é undefined/null.'}`);
    const routeFoundBtn = document.getElementById('route-found-btn'); // Pega referência ao botão

    if (foundMarkers && Array.isArray(foundMarkers)) {
        if (foundMarkers.length > 0) {
             console.log(`>>> clearFoundMarkers: Removendo ${foundMarkers.length} marcadores do mapa...`);
             try {
                  foundMarkers.forEach((marker, index) => {
                       if (marker && typeof marker.setMap === 'function') { marker.setMap(null); }
                       else { console.warn(`>>> clearFoundMarkers: Item no índice ${index} não é um marcador válido.`); }
                  });
                  console.log(`>>> clearFoundMarkers: Marcadores removidos do mapa.`);
             } catch (e) { console.error(`>>> clearFoundMarkers: Erro durante forEach/setMap(null):`, e); }

             // Tenta zerar o array usando length = 0
             try {
                  foundMarkers.length = 0;
                  console.log(`>>> clearFoundMarkers: Array 'foundMarkers' zerado via length (length atual: ${foundMarkers.length}).`);
             } catch (e) {
                  console.error(`>>> clearFoundMarkers: Erro ao tentar zerar array com length = 0:`, e);
                  console.log(`>>> clearFoundMarkers: Tentando resetar com 'foundMarkers = [];' como fallback.`);
                  foundMarkers = []; // Fallback
             }
        } else {
             console.log(">>> clearFoundMarkers: Array 'foundMarkers' já estava vazio (length 0).");
        }
    } else {
        console.warn(">>> clearFoundMarkers: 'foundMarkers' não é um array válido. Resetando para [].");
        foundMarkers = []; // Garante que seja um array vazio
    }

    // Garante que o botão Traçar Rota seja desabilitado
    if (routeFoundBtn) { routeFoundBtn.disabled = true; }
    // Limpa a rota do display (embora não estejamos traçando rotas ainda)
    // if (directionsRenderer) { directionsRenderer.setDirections({ routes: [] }); }
    console.log(">>> clearFoundMarkers: Limpeza concluída. Estado final de foundMarkers:", foundMarkers ? foundMarkers.length : 'undefined');
}


// --- FUNÇÕES E LISTENERS COMPLETOS (AINDA NÃO REINTRODUZIDOS COMPLETAMENTE) ---
// setupEventListeners() // Função principal de setup foi substituída por setupCategoryListeners
// Listener 'routeFoundBtn' // Ainda desativado nesta versão
// Listener 'addLocationBtn' e 'searchInput' // Ainda desativados
// Listener 'selectedLocationsList' // Ainda desativado
// Listener 'backButton' // Ainda desativado


// Chamada inicial (via callback da API do Google Maps)
console.log("Aguardando API do Google Maps chamar initMap...");