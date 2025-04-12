// ========================================================================
// Rota Fácil - script.js
// VERSÃO BASE + ADIÇÃO/REMOÇÃO MANUAL FUNCIONAL (via Autocomplete)
// ========================================================================

// --- Variáveis Globais ---
let map;
let placesService;
let foundMarkers = [];            // Guarda marcadores da BUSCA POR CATEGORIA E ADIÇÃO MANUAL
let currentUserLocation = null;   // Guarda coords {lat, lng} do usuário
let userLocationMarker = null;    // Guarda o objeto Marker da SETA do usuário
let userLocationAccuracyCircle = null; // Guarda o objeto Circle da precisão
let watchId = null;               // Guarda o ID do watchPosition

// --- Serviços de Rota (Inicializados depois, se necessário) ---
let directionsService = null;
let directionsRenderer = null;
let currentRouteResult = null; // Mantido caso botão voltar seja reativado
let currentRouteRequest = null;// Mantido caso botão voltar seja reativado
let isRecalculating = false;   // Mantido caso botão voltar seja reativado

// --- Elementos da UI (Inicializados em setupEventListeners) ---
let appContainer = null;
let routeFoundBtn = null;
let backButton = null; // <<< Mantido, mas lógica desativada por enquanto
let searchInput = null; // <<< Campo de busca manual
let addLocationBtn = null; // <<< Botão de adicionar manual (não terá ação direta)
let selectedLocationsList = null; // <<< Lista UL para locais manuais
let autocomplete = null; // <<< Variável para o serviço Autocomplete

// --- Reset Inicial (Exatamente como no script base) ---
userLocationMarker = null; userLocationAccuracyCircle = null;
if (navigator.geolocation && typeof watchId !== 'undefined' && watchId !== null) { try { navigator.geolocation.clearWatch(watchId); } catch (e) { console.error(">>> Script Init: Erro ao limpar watchId:", e); } }
watchId = null; foundMarkers = []; console.log(">>> Script Init: Resetado.");
// -------------------------------------------------------

// Bloco updateUserMarkerAndAccuracy (Exatamente como no script base)
function updateUserMarkerAndAccuracy(position) {
    console.log(">>> updateUserMarkerAndAccuracy: INÍCIO.");
    if (!position || !position.coords) { console.warn(">>> updateUserMarkerAndAccuracy: Posição inválida."); return; }
    // Verificação extra para robustez
    if (!map || typeof map.setCenter !== 'function' || typeof map.getProjection !== 'function') {
        console.error(">>> updateUserMarkerAndAccuracy: Mapa inválido ou não totalmente inicializado!"); return;
    }
    const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
    currentUserLocation = pos;
    const accuracy = position.coords.accuracy;
    const heading = position.coords.heading;
    console.log(">>> updateUserMarkerAndAccuracy: Mapa e posição OK.");

    const performVisualUpdate = () => {
        console.log(">>> updateUserMarkerAndAccuracy (performVisualUpdate): Executando...");
        try {
            if (userLocationAccuracyCircle) {
                userLocationAccuracyCircle.setCenter(pos); userLocationAccuracyCircle.setRadius(accuracy);
            } else {
                userLocationAccuracyCircle = new google.maps.Circle({ map: map, center: pos, radius: accuracy, strokeColor: '#1a73e8', strokeOpacity: 0.4, strokeWeight: 1, fillColor: '#1a73e8', fillOpacity: 0.1, zIndex: 1 });
            }
        } catch(circleError) { console.error("!!! ERRO Círculo:", circleError); }

        let iconConfig = { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, fillColor: '#1a73e8', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2, scale: 6, anchor: new google.maps.Point(0, 2.5), rotation: 0 };
        if (heading !== null && !isNaN(heading) && typeof heading === 'number') { iconConfig.rotation = heading; }

        try {
            if (userLocationMarker) {
                userLocationMarker.setIcon(iconConfig); userLocationMarker.setPosition(pos);
                if (userLocationMarker.getMap() !== map) { userLocationMarker.setMap(map); }
            } else {
                userLocationMarker = new google.maps.Marker({ position: pos, map: map, title: 'Sua localização', icon: iconConfig, zIndex: 2 });
            }
        } catch (markerError) { console.error("!!! ERRO Marcador/Seta:", markerError); userLocationMarker = null; }
        console.log(">>> updateUserMarkerAndAccuracy (performVisualUpdate): FIM.");
    };

    if (map.getProjection()) { performVisualUpdate(); }
    else {
         console.warn(">>> updateUserMarkerAndAccuracy: Mapa não pronto, aguardando 'tilesloaded'...");
         const listener = google.maps.event.addListenerOnce(map, 'tilesloaded', performVisualUpdate);
         setTimeout(() => { if (listener && (!userLocationMarker || !userLocationMarker.getMap())) { google.maps.event.removeListener(listener); performVisualUpdate(); } }, 3000);
    }
    console.log(">>> updateUserMarkerAndAccuracy: FIM.");
}


// handleLocationError (Exatamente como no script base)
function handleLocationError(error, isWatching) {
    let prefix = isWatching ? 'Erro Watch' : 'Erro Get';
    let message = `${prefix}: ${error.message} (Code: ${error.code})`;
    console.warn(message);

    if (isWatching && error.code === error.PERMISSION_DENIED) {
       console.warn(">>> handleLocationError: Permissão negada durante watch. Limpando marcador/círculo/watch.");
       if (userLocationMarker) { try { userLocationMarker.setMap(null); } catch(e){} userLocationMarker = null; }
       if (userLocationAccuracyCircle) { try { userLocationAccuracyCircle.setMap(null); } catch(e){} userLocationAccuracyCircle = null; }
       if (watchId !== null) { try { navigator.geolocation.clearWatch(watchId); } catch(e){} watchId = null; }
    }
}

// initMap (Exatamente como no script base)
function initMap() {
    console.log(">>> initMap: Iniciando...");
    userLocationMarker = null;
    userLocationAccuracyCircle = null;
    console.log(">>> initMap: Marcador/Círculo resetados para null.");

    if (navigator.geolocation) {
        console.log(">>> initMap: Tentando obter localização inicial...");
        navigator.geolocation.getCurrentPosition(
            (position) => {
                console.log(">>> initMap: Localização inicial OBTIDA.");
                currentUserLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
                initializeMapAndServices(currentUserLocation, 15);
            },
            (error) => {
                console.warn(">>> initMap: Erro ao obter localização inicial.");
                currentUserLocation = null;
                const defaultCoords = { lat: -23.5505, lng: -46.6333 };
                initializeMapAndServices(defaultCoords, 13);
                handleLocationError(error, false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    } else {
        console.warn(">>> initMap: Geolocalização não suportada.");
        currentUserLocation = null;
        const defaultCoords = { lat: -23.5505, lng: -46.6333 };
        initializeMapAndServices(defaultCoords, 13);
    }
}

// startWatchingPosition (Exatamente como no script base)
function startWatchingPosition() {
     if (!navigator.geolocation) { console.warn(">>> startWatchingPosition: Geo não suportada."); return; }
     if (watchId !== null) { try { navigator.geolocation.clearWatch(watchId); } catch(e) { console.error("Erro ao limpar watchId:", e); } watchId = null; }
     console.log(">>> startWatchingPosition: Tentando iniciar...");
     try {
         watchId = navigator.geolocation.watchPosition(
             (newPosition) => { updateUserMarkerAndAccuracy(newPosition); },
             (error) => { console.error("!!! watchPosition: ERRO:", error.code, error.message); handleLocationError(error, true); },
             { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
         );
         console.log(`>>> startWatchingPosition: Iniciado com watchId: ${watchId}`);
     } catch (watchError) { console.error("!!! ERRO GERAL ao iniciar watchPosition:", watchError); watchId = null; }
 }

// initializeMapAndServices (Exatamente como no script base)
function initializeMapAndServices(initialCoords, initialZoom) {
    console.log(">>> initializeMapAndServices: Iniciando...");
    const mapDiv = document.getElementById('map-container');
    if (!mapDiv) { console.error("!!! ERRO CRÍTICO: #map-container não encontrado!"); return; }
    const loadingP = mapDiv.querySelector('p'); if (loadingP) loadingP.remove();

    try {
        console.log(">>> initializeMapAndServices: Criando mapa...");
        map = new google.maps.Map(mapDiv, { center: initialCoords, zoom: initialZoom });
        console.log(">>> initializeMapAndServices: Mapa criado.");
        placesService = new google.maps.places.PlacesService(map);
        console.log(">>> initializeMapAndServices: PlacesService criado.");
        directionsService = new google.maps.DirectionsService();
        directionsRenderer = new google.maps.DirectionsRenderer({ map: map, suppressMarkers: false });
        console.log(">>> initializeMapAndServices: Directions criados.");

        console.log(">>> initializeMapAndServices: Serviços Google prontos.");
        setupEventListeners(); // Chama listeners DEPOIS

        if (currentUserLocation) {
             const initialPositionLike = { coords: { latitude: currentUserLocation.lat, longitude: currentUserLocation.lng, accuracy: 20, heading: null } };
             updateUserMarkerAndAccuracy(initialPositionLike);
        }
        startWatchingPosition(); // Inicia watch DEPOIS

    } catch (error) {
        console.error("!!! ERRO GERAL em initializeMapAndServices:", error);
        if (mapDiv) { mapDiv.innerHTML = `<p style="color: red;">ERRO: ${error.message}</p>`; }
    }
}


/**
 * Configura TODOS os listeners de eventos necessários.
 * >>> FOCO: Adicionar Autocomplete e lógica de lista manual. <<<
 */
function setupEventListeners() {
    console.log(">>> setupEventListeners: Configurando...");

    // Pega referências
    appContainer = document.getElementById('app-container');
    backButton = document.getElementById('back-button');
    searchInput = document.getElementById('search-input'); // Campo de busca manual
    addLocationBtn = document.getElementById('add-location-btn'); // Botão adicionar
    selectedLocationsList = document.getElementById('selected-locations-list'); // Lista UL
    const categoryButtons = document.querySelectorAll('.category-btn');
    routeFoundBtn = document.getElementById('route-found-btn');

    // Verifica elementos essenciais
    let missingElement = null;
    if (!appContainer) missingElement = '#app-container';
    else if (!searchInput) missingElement = '#search-input'; // ESSENCIAL
    else if (!addLocationBtn) missingElement = '#add-location-btn'; // Pega ref, mas ação é via Autocomplete
    else if (!selectedLocationsList) missingElement = '#selected-locations-list'; // ESSENCIAL
    else if (!categoryButtons || categoryButtons.length === 0) missingElement = '.category-btn';
    else if (!routeFoundBtn) missingElement = '#route-found-btn';
    if (missingElement) { console.error(`ERRO FATAL: Elemento "${missingElement}" não encontrado!`); return; }
    if (!backButton) { console.warn("AVISO: Botão #back-button não encontrado."); }


    // --- Listener Botões de Categoria (Exatamente como no script base) ---
    // LEMBRETE: Chama clearFoundMarkers(), que limpa TUDO (manuais incluídos).
    categoryButtons.forEach(button => {
        button.addEventListener('click', function() {
            const categoryType = this.dataset.category;
            console.log(`>>> CATEGORIA CLICADA: "${categoryType}" <<<`);
            if (!map || !placesService) { alert("Mapa/Places não pronto!"); return; }
            console.log(`--- Iniciando busca por categoria "${categoryType}" ---`);
            if(routeFoundBtn) routeFoundBtn.disabled = true;

            // Limpa marcadores anteriores (CATEGORIA E MANUAIS) e a lista visual
            clearFoundMarkers();

            let request;
            if (currentUserLocation) {
                request = { location: currentUserLocation, radius: 5000, keyword: categoryType };
                placesService.nearbySearch(request, handleSearchResults);
            } else {
                const bounds = map.getBounds();
                if (!bounds) { alert("Área do mapa indefinida."); return; }
                request = { bounds: bounds, query: categoryType };
                placesService.textSearch(request, handleSearchResults);
            }
        });
    });

    // --- Listener Botão "Traçar Rota" (Exatamente como no script base) ---
    // Usará a lista foundMarkers que agora contém locais de categoria E manuais.
    if (routeFoundBtn) {
        routeFoundBtn.addEventListener('click', function() {
            console.log(`>>> [Traçar Rota Clicado] Iniciando. Total de locais: ${foundMarkers.length}`);
             if (!directionsService || !directionsRenderer) { alert("ERRO: Serviço de rotas não pronto."); return; }
             if (!foundMarkers || foundMarkers.length === 0) { alert("Nenhum local encontrado ou adicionado para a rota."); return; }
             if (!map) { alert("ERRO: Mapa não está pronto."); return; }

             this.disabled = true; this.textContent = "Localizando...";

             if (navigator.geolocation) {
                 navigator.geolocation.getCurrentPosition(
                     (position) => {
                         this.textContent = "Calculando Rota...";
                         const userPos = { lat: position.coords.latitude, lng: position.coords.longitude };
                         currentUserLocation = userPos;
                         updateUserMarkerAndAccuracy(position);

                         if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });

                         const MAX_ALLOWED_WAYPOINTS = 10;
                         const markersForRoute = foundMarkers.slice(0, MAX_ALLOWED_WAYPOINTS + 1);
                         const waypointsLimited = markersForRoute.map(m => ({ location: m.getPosition(), stopover: true }));

                         let originPoint = userPos;
                         let destinationPoint;
                         let waypointsForRequest = [];

                         if (waypointsLimited.length === 0) { alert("Erro interno: Nenhum marcador válido."); this.disabled = false; this.textContent = "Traçar Rota"; return; }
                         else if (waypointsLimited.length === 1) { destinationPoint = waypointsLimited[0].location; }
                         else { destinationPoint = waypointsLimited[waypointsLimited.length - 1].location; waypointsForRequest = waypointsLimited.slice(0, -1); }

                         const request = { origin: originPoint, destination: destinationPoint, waypoints: waypointsForRequest, optimizeWaypoints: true, travelMode: google.maps.TravelMode.DRIVING };

                         directionsService.route(request, (result, status) => {
                             if (status === google.maps.DirectionsStatus.OK) {
                                 directionsRenderer.setDirections(result);
                                 currentRouteResult = result; currentRouteRequest = request; isRecalculating = false;
                                 if (appContainer) {
                                     appContainer.classList.add('map-only-mode'); // Ativa modo mapa
                                     setTimeout(() => { if (map) { google.maps.event.trigger(map, 'resize'); if (result.routes[0].bounds) { map.fitBounds(result.routes[0].bounds); } } }, 350);
                                 }
                                 this.textContent = "Rota Traçada";
                             } else {
                                 alert(`Não foi possível calcular a rota: ${status}.`);
                                 currentRouteResult = null; currentRouteRequest = null;
                                 this.disabled = foundMarkers.length === 0; this.textContent = "Traçar Rota";
                             }
                         });
                     }, (error) => {
                         alert("Não foi possível obter sua localização para traçar a rota.");
                         this.disabled = foundMarkers.length === 0; this.textContent = "Traçar Rota";
                         handleLocationError(error, false); // Adicionado para logar erro
                     }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
                 );
             } else {
                 alert("Geolocalização não suportada."); this.disabled = foundMarkers.length === 0; this.textContent = "Traçar Rota";
             }
        });
    }


    // --- Listener Botão Adicionar Manual (Ação desativada) ---
     if (addLocationBtn) {
         addLocationBtn.addEventListener('click', () => {
             console.log("Botão Adicionar Manual clicado - Ação via seleção do Autocomplete.");
         });
         // addLocationBtn.disabled = true; // Desabilitar se não for usar
     }

    // *******************************************************************
    // ***** INÍCIO: CÓDIGO PARA ADIÇÃO MANUAL E REMOÇÃO DA LISTA *****
    // *******************************************************************

    // --- Configuração do Autocomplete ---
    // Adicionado um timeout para garantir que a API do Google Maps esteja totalmente carregada
    setTimeout(() => {
        if (searchInput && map && typeof google !== 'undefined' && google.maps && google.maps.places) {
            console.log(">>> Configurando Autocomplete...");
            try {
                autocomplete = new google.maps.places.Autocomplete(searchInput, {
                    componentRestrictions: { country: "br" },
                    fields: ["place_id", "geometry", "name", "formatted_address"]
                });

                autocomplete.bindTo('bounds', map);

                autocomplete.addListener('place_changed', () => {
                    console.log("--- Autocomplete: Local selecionado ---");
                    const place = autocomplete.getPlace();

                    if (!place.geometry || !place.geometry.location) {
                        console.warn("Autocomplete: Local inválido ou sem coordenadas.");
                        return;
                    }

                    const alreadyExists = foundMarkers.some(marker => marker.placeId === place.place_id);
                    if (alreadyExists) {
                        alert(`"${place.name}" já foi adicionado.`);
                        searchInput.value = '';
                        return;
                    }

                    console.log(`Autocomplete: Adicionando "${place.name}"`);

                    const manualMarker = new google.maps.Marker({
                        map: map,
                        position: place.geometry.location,
                        title: place.name,
                    });
                    manualMarker.placeId = place.place_id; // Guarda ID único

                    foundMarkers.push(manualMarker);
                    console.log(`   Marcador adicionado a foundMarkers. Total: ${foundMarkers.length}`);

                    addPlaceToList(place.name, place.formatted_address, manualMarker.placeId);

                    map.panTo(place.geometry.location);
                    searchInput.value = '';

                    if (routeFoundBtn) {
                        routeFoundBtn.disabled = false;
                        console.log("   Botão Traçar Rota HABILITADO.");
                    }
                });
            } catch (e) {
                console.error("!!! ERRO ao inicializar Autocomplete:", e);
                alert("Erro ao ativar a busca por locais. Tente recarregar a página.");
            }
        } else {
            console.error("Autocomplete não iniciado: Elementos ou API Google não prontos após timeout.");
            // Tenta novamente após mais um tempo? Ou alerta o usuário?
            // alert("A função de busca por locais não pôde ser iniciada.");
        }
    }, 1500); // Aumentado o delay para 1.5 segundos para garantir que a API carregue

    // --- Listener para Remover Itens da Lista Manual ---
    if (selectedLocationsList) {
        selectedLocationsList.addEventListener('click', function(event) {
            if (event.target && event.target.classList.contains('remove-btn')) {
                const listItem = event.target.closest('li');
                const placeIdToRemove = listItem.dataset.placeId;

                if (!placeIdToRemove) { console.error("Remover: place_id não encontrado no LI."); return; }
                console.log(`--- Remover: Tentando remover place_id: ${placeIdToRemove}`);

                let markerIndex = foundMarkers.findIndex(marker => marker.placeId === placeIdToRemove);

                if (markerIndex > -1) {
                    foundMarkers[markerIndex].setMap(null); // Remove do mapa
                    console.log(`   Marcador "${foundMarkers[markerIndex].getTitle()}" removido do mapa.`);
                    foundMarkers.splice(markerIndex, 1); // Remove do array
                    console.log(`   Marcador removido de foundMarkers. Restantes: ${foundMarkers.length}`);
                    listItem.remove(); // Remove da lista visual
                    console.log("   Item removido da lista UL.");
                    if (routeFoundBtn) { // Atualiza botão traçar rota
                        routeFoundBtn.disabled = foundMarkers.length === 0;
                        console.log(`   Botão Traçar Rota ${routeFoundBtn.disabled ? 'DESABILITADO' : 'HABILITADO'}.`);
                    }
                } else {
                    console.error(`Remover: Marcador com place_id ${placeIdToRemove} não encontrado em foundMarkers.`);
                    listItem.remove(); // Remove da lista visual mesmo assim
                }
            }
        });
    }
    // *******************************************************************
    // ***** FIM: CÓDIGO PARA ADIÇÃO MANUAL E REMOÇÃO DA LISTA *****
    // *******************************************************************


    // --- Listener Botão Voltar (Lógica interna desativada por enquanto) ---
    if (backButton && appContainer) {
        backButton.addEventListener('click', () => {
             console.log("Botão Voltar clicado (lógica desativada).");
             alert("Funcionalidade do Botão Voltar desativada.");
        });
    }

    console.log(">>> setupEventListeners: Concluído.");
} // --- FIM DA FUNÇÃO setupEventListeners ---

/**
 * NOVA FUNÇÃO: Adiciona um item à lista visual UL.
 */
function addPlaceToList(name, address, placeId) {
    if (!selectedLocationsList || !placeId) {
        console.error("addPlaceToList: Lista UL ou placeId inválido.");
        return;
     }

    const listItem = document.createElement('li');
    listItem.dataset.placeId = placeId; // Armazena ID para remoção

    let displayText = name;
    if (address) {
        let shortAddress = address.split(',')[0];
        if (shortAddress.toLowerCase() !== name.toLowerCase()) { displayText += ` (${shortAddress})`; }
    }
    listItem.textContent = displayText; // Define o texto

    const removeButton = document.createElement('button');
    removeButton.textContent = 'X'; // Botão Remover curto
    removeButton.classList.add('remove-btn');
    // Estilos básicos (mova para CSS se preferir)
    removeButton.style.marginLeft = '8px'; removeButton.style.padding = '2px 5px';
    removeButton.style.fontSize = '0.8em'; removeButton.style.cursor = 'pointer';
    removeButton.style.color = 'red'; removeButton.style.border = '1px solid red';
    removeButton.style.background = 'none';

    listItem.appendChild(removeButton); // Adiciona botão ao LI
    selectedLocationsList.appendChild(listItem); // Adiciona LI à UL
    console.log(`   Item adicionado à lista UL: ${name}`);
}


// handleSearchResults (Exatamente como no script base)
// Processa resultados da BUSCA POR CATEGORIA
function handleSearchResults(results, status) {
    console.log(`>>> handleSearchResults (Categoria): Status: "${status}". Resultados:`, results ? results.length : 0);
    // clearFoundMarkers() é chamado ANTES no listener da categoria

    if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
        let bounds = new google.maps.LatLngBounds();
        let validCount = 0;
        results.forEach((place, index) => {
            if (place.name && place.geometry && place.geometry.location) {
                try {
                     const categoryMarker = new google.maps.Marker({ position: place.geometry.location, map: map, title: place.name });
                     foundMarkers.push(categoryMarker); // Adiciona ao array geral
                     bounds.extend(place.geometry.location);
                     validCount++;
                } catch(e) { console.error(`Erro marcador categoria ${place.name}:`, e); }
            }
        });

        if (validCount > 0) {
             console.log(`>>> handleSearchResults (Categoria): ${validCount} marcadores adicionados.`);
             if (currentUserLocation) bounds.extend(currentUserLocation);
             // Inclui marcadores MANUAIS existentes no ajuste do mapa
             foundMarkers.forEach(marker => { if (marker.getMap() === map) { bounds.extend(marker.getPosition()); } });

             if (!bounds.isEmpty()) {
                 try { map.fitBounds(bounds); if (map.getZoom() > 16) map.setZoom(16); }
                 catch (e) { console.error("Erro fitBounds/setZoom (Categoria):", e); }
             }
             if (routeFoundBtn) routeFoundBtn.disabled = false;
        } else {
             if (routeFoundBtn) routeFoundBtn.disabled = foundMarkers.length === 0; // Baseado no total (inclui manuais)
        }
    } else {
         if (routeFoundBtn) routeFoundBtn.disabled = foundMarkers.length === 0; // Baseado no total (inclui manuais)
         console.warn(`>>> handleSearchResults (Categoria): Sem resultados ou erro. Status: ${status}.`);
    }
    console.log(">>> handleSearchResults (Categoria): FIM.");
}


// clearFoundMarkers (Exatamente como no script base - Limpa TUDO)
// Chamado APENAS ao clicar em um botão de CATEGORIA.
function clearFoundMarkers() {
    console.log(`>>> clearFoundMarkers: Limpando ${foundMarkers.length} marcadores.`);
    if (foundMarkers && foundMarkers.length > 0) {
         try { foundMarkers.forEach((marker) => { if (marker && marker.setMap) { marker.setMap(null); } }); }
         catch (e) { console.error(`Erro ao remover marcadores:`, e); }
    }
    foundMarkers = []; // Limpa o array
    if(selectedLocationsList) { // Limpa a lista visual UL
        selectedLocationsList.innerHTML = '';
        console.log("   Lista visual UL limpa.");
    }
    if (routeFoundBtn) { routeFoundBtn.disabled = true; } // Desabilita botão
    console.log(`>>> clearFoundMarkers: Limpeza concluída.`);
}

// Chamada inicial (Exatamente como no script base)
console.log("Aguardando API do Google Maps chamar initMap...");