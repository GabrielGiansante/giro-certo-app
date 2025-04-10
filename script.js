// ========================================================================
// Rota Fácil - script.js
// VERSÃO CORRETA FORNECIDA PELO USUÁRIO + BOTÃO VOLTAR FUNCIONAL
// ========================================================================

// --- Variáveis Globais ---
let map;
let placesService;
let foundMarkers = [];            // Guarda marcadores da busca por categoria
let currentUserLocation = null;   // Guarda coords {lat, lng} do usuário
let userLocationMarker = null;    // Guarda o objeto Marker da SETA do usuário
let userLocationAccuracyCircle = null; // Guarda o objeto Circle da precisão
let watchId = null;               // Guarda o ID do watchPosition

// --- Serviços de Rota (Inicializados depois, se necessário) ---
let directionsService = null;
let directionsRenderer = null;
// <<< Variáveis adicionadas para estado da rota (necessárias para o Voltar) >>>
let currentRouteResult = null;
let currentRouteRequest = null;
let isRecalculating = false; // Para uso futuro, se necessário

// --- Elementos da UI (Inicializados em setupEventListeners) ---
let appContainer = null;
let routeFoundBtn = null;
// <<< Referência para o backButton adicionada aqui para clareza >>>
let backButton = null;
let searchInput = null;
let addLocationBtn = null;
let selectedLocationsList = null;

// --- Reset Inicial Garantido das Variáveis de Estado ---
userLocationMarker = null;
userLocationAccuracyCircle = null;
if (navigator.geolocation && typeof watchId !== 'undefined' && watchId !== null) {
    console.log(">>> Script Init: Limpando watchId pré-existente:", watchId);
    try { navigator.geolocation.clearWatch(watchId); } catch (e) { console.error(">>> Script Init: Erro ao limpar watchId:", e); }
}
watchId = null;
foundMarkers = [];
console.log(">>> Script Init: Variáveis de estado resetadas.");
// -------------------------------------------------------

// Bloco para updateUserMarkerAndAccuracy (Exatamente como você forneceu)
function updateUserMarkerAndAccuracy(position) {
    console.log(">>> updateUserMarkerAndAccuracy: INÍCIO.");

    if (!position || !position.coords) { console.warn(">>> updateUserMarkerAndAccuracy: Posição inválida."); return; }
    // Adicionando verificação extra para robustez, sem mudar a lógica original
    if (!map || typeof map.setCenter !== 'function' || typeof map.getProjection !== 'function') {
        console.error(">>> updateUserMarkerAndAccuracy: Mapa inválido ou não totalmente inicializado!");
        return;
    }

    const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
    currentUserLocation = pos;
    const accuracy = position.coords.accuracy;
    const heading = position.coords.heading;

    console.log(">>> updateUserMarkerAndAccuracy: Mapa e posição OK. Definindo função para atualizar marcador/círculo...");

    const performVisualUpdate = () => {
        console.log(">>> updateUserMarkerAndAccuracy (performVisualUpdate): Executando atualização visual...");
        try {
            if (userLocationAccuracyCircle) {
                userLocationAccuracyCircle.setCenter(pos); userLocationAccuracyCircle.setRadius(accuracy);
            } else {
                console.log(">>> (performVisualUpdate): Criando NOVO círculo...");
                userLocationAccuracyCircle = new google.maps.Circle({ map: map, center: pos, radius: accuracy, strokeColor: '#1a73e8', strokeOpacity: 0.4, strokeWeight: 1, fillColor: '#1a73e8', fillOpacity: 0.1, zIndex: 1 });
            }
            console.log(">>> (performVisualUpdate): Círculo OK.");
        } catch(circleError) { console.error("!!! ERRO Círculo:", circleError); }

        let iconConfig = {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, fillColor: '#1a73e8', fillOpacity: 1,
            strokeColor: '#ffffff', strokeWeight: 2, scale: 6, anchor: new google.maps.Point(0, 2.5), rotation: 0
        };
        if (heading !== null && !isNaN(heading) && typeof heading === 'number') { iconConfig.rotation = heading; }

        try {
            if (userLocationMarker) {
                console.log(">>> (performVisualUpdate): Atualizando SETA existente...");
                userLocationMarker.setIcon(iconConfig);
                userLocationMarker.setPosition(pos);
                if (userLocationMarker.getMap() !== map) {
                     console.warn(">>> (performVisualUpdate): SETA não estava no mapa atual! Readicionando...");
                     userLocationMarker.setMap(map);
                }
                console.log(">>> (performVisualUpdate): SETA ATUALIZADA.");
            } else {
                console.log(">>> (performVisualUpdate): Criando NOVA SETA...");
                userLocationMarker = new google.maps.Marker({ position: pos, map: map, title: 'Sua localização', icon: iconConfig, zIndex: 2 });
                console.log(">>> (performVisualUpdate): NOVA SETA CRIADA.");
            }
        } catch (markerError) { console.error("!!! ERRO Marcador/Seta:", markerError); userLocationMarker = null; }

        console.log(">>> updateUserMarkerAndAccuracy (performVisualUpdate): FIM.");
    };

    if (map.getProjection()) {
         console.log(">>> updateUserMarkerAndAccuracy: Mapa parece pronto. Executando update agora.");
         performVisualUpdate();
    } else {
         console.warn(">>> updateUserMarkerAndAccuracy: Mapa ainda não parece pronto. Aguardando 'tilesloaded'...");
         const listener = google.maps.event.addListenerOnce(map, 'tilesloaded', () => {
              console.log(">>> updateUserMarkerAndAccuracy: Evento 'tilesloaded' disparado!");
              performVisualUpdate();
         });
         setTimeout(() => {
              if (listener && (!userLocationMarker || !userLocationMarker.getMap())) {
                   console.warn(">>> updateUserMarkerAndAccuracy: Timeout (3s) esperando 'tilesloaded'. Removendo listener e tentando update mesmo assim...");
                   google.maps.event.removeListener(listener);
                   performVisualUpdate();
              }
         }, 3000);
    }
    console.log(">>> updateUserMarkerAndAccuracy: FIM (update pode estar aguardando tilesloaded).");
}

// handleLocationError (Exatamente como você forneceu)
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

// initMap (Exatamente como você forneceu)
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

// startWatchingPosition (Exatamente como você forneceu)
function startWatchingPosition() {
     if (!navigator.geolocation) { console.warn(">>> startWatchingPosition: Geo não suportada."); return; }
     if (watchId !== null) {
          console.warn(">>> startWatchingPosition: Limpando watchId anterior:", watchId);
          try { navigator.geolocation.clearWatch(watchId); } catch(e) { console.error(">>> startWatchingPosition: Erro ao limpar watchId anterior:", e); }
          watchId = null;
     }
     console.log(">>> startWatchingPosition: Tentando iniciar...");
     try {
         watchId = navigator.geolocation.watchPosition(
             (newPosition) => {
                 console.log("--- watchPosition: Sucesso. Chamando update...");
                 updateUserMarkerAndAccuracy(newPosition);
             },
             (error) => {
                 console.error("!!! watchPosition: ERRO recebido:", error.code, error.message);
                 handleLocationError(error, true);
             },
             { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
         );
         console.log(`>>> startWatchingPosition: Iniciado com watchId: ${watchId}`);
     } catch (watchError) { console.error("!!! ERRO GERAL ao iniciar watchPosition:", watchError); watchId = null; }
 }

// initializeMapAndServices (Exatamente como você forneceu)
function initializeMapAndServices(initialCoords, initialZoom) {
    console.log(">>> initializeMapAndServices: Iniciando...");
    const mapDiv = document.getElementById('map-container');
    if (!mapDiv) { console.error("!!! ERRO CRÍTICO: #map-container não encontrado!"); return; }
    const loadingP = mapDiv.querySelector('p'); if (loadingP) loadingP.remove();

    try {
        console.log(">>> initializeMapAndServices: Criando mapa...");
        map = new google.maps.Map(mapDiv, { center: initialCoords, zoom: initialZoom });
        console.log(">>> initializeMapAndServices: Mapa criado. Criando PlacesService...");
        placesService = new google.maps.places.PlacesService(map);
        console.log(">>> initializeMapAndServices: PlacesService criado.");
        console.log(">>> initializeMapAndServices: Criando DirectionsService/Renderer...");
        directionsService = new google.maps.DirectionsService();
        directionsRenderer = new google.maps.DirectionsRenderer({ map: map, suppressMarkers: false });
        console.log(">>> initializeMapAndServices: Directions criados.");

        console.log(">>> initializeMapAndServices: Serviços Google prontos.");
        setupEventListeners();

        if (currentUserLocation) {
             console.log(">>> initializeMapAndServices: Chamando update inicial da seta...");
             const initialPositionLike = { coords: { latitude: currentUserLocation.lat, longitude: currentUserLocation.lng, accuracy: 20, heading: null } };
             updateUserMarkerAndAccuracy(initialPositionLike);
        }
        startWatchingPosition();

    } catch (error) {
        console.error("!!! ERRO GERAL em initializeMapAndServices:", error);
        if (mapDiv) { mapDiv.innerHTML = `<p style="color: red; padding: 20px;">ERRO: ${error.message}</p>`; }
    }
}

/**
 * Configura TODOS os listeners de eventos necessários.
 */
function setupEventListeners() {
    console.log(">>> setupEventListeners: Configurando...");

    // Pega referências (garantindo todas aqui)
    appContainer = document.getElementById('app-container');
    backButton = document.getElementById('back-button'); // << Pega referência
    searchInput = document.getElementById('search-input');
    addLocationBtn = document.getElementById('add-location-btn');
    selectedLocationsList = document.getElementById('selected-locations-list');
    const categoryButtons = document.querySelectorAll('.category-btn');
    routeFoundBtn = document.getElementById('route-found-btn');

    // Verifica elementos essenciais (adicionada verificação do backButton)
    let missingElement = null;
    if (!appContainer) missingElement = '#app-container';
    else if (!searchInput) missingElement = '#search-input';
    else if (!addLocationBtn) missingElement = '#add-location-btn';
    else if (!selectedLocationsList) missingElement = '#selected-locations-list';
    else if (!categoryButtons || categoryButtons.length === 0) missingElement = '.category-btn';
    else if (!routeFoundBtn) missingElement = '#route-found-btn';
    else if (!backButton) missingElement = '#back-button'; // << Verifica se backButton existe
    if (missingElement) { console.error(`ERRO FATAL: Elemento "${missingElement}" não encontrado!`); return; }
    // Removido o console.warn antigo sobre backButton

    // --- Configuração Autocomplete (Exatamente como você forneceu) ---
    // ... (código do autocomplete como antes) ...
    // setTimeout(() => { /* ... código autocomplete ... */ }, 500);


    // --- Listener Botões de Categoria (Exatamente como você forneceu) ---
    categoryButtons.forEach(button => {
        button.addEventListener('click', function() {
            const categoryType = this.dataset.category;
            console.log(`>>> CATEGORIA CLICADA: "${categoryType}" <<<`);
            if (!map || !placesService || typeof placesService.nearbySearch !== 'function') {
                alert("Mapa/Places não pronto!"); console.error("Busca categoria: Dependências inválidas."); return;
            }
            console.log(`--- Iniciando busca para "${categoryType}" ---`);
            if(routeFoundBtn) routeFoundBtn.disabled = true;
            clearFoundMarkers();

            let request;
            if (currentUserLocation) {
                console.log("--- Buscando perto (nearbySearch) ---");
                request = { location: currentUserLocation, radius: 5000, keyword: categoryType };
                placesService.nearbySearch(request, handleSearchResults);
            } else {
                console.log("--- Buscando na área visível (textSearch) ---");
                const bounds = map.getBounds(); // <<< Adicionada verificação extra aqui
                if (!bounds) {
                     alert("Área do mapa indefinida. Tente mover o mapa.");
                     console.error("Busca categoria: map.getBounds() retornou inválido.");
                     return;
                 }
                request = { bounds: bounds, query: categoryType };
                placesService.textSearch(request, handleSearchResults);
            }
        });
    });

    // --- Listener Botão "Traçar Rota" (Exatamente como você forneceu - JÁ ADICIONA A CLASSE) ---
    if (routeFoundBtn) {
        routeFoundBtn.addEventListener('click', function() {
            console.log(`>>> [Traçar Rota Clicado] Iniciando. Número de foundMarkers: ${foundMarkers.length}`);
            // Verificações
            if (!directionsService || !directionsRenderer) { alert("ERRO: Serviço de rotas não pronto."); return; }
            if (!foundMarkers || foundMarkers.length === 0) { alert("Nenhum local encontrado para rota."); return; }
            if (!map || typeof map.setCenter !== 'function') { alert("ERRO: Mapa não está pronto."); return; }

            console.log(">>> [Traçar Rota Clicado] Verificações OK. Solicitando localização...");
            this.disabled = true; this.textContent = "Localizando...";

            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        this.textContent = "Calculando Rota...";
                        const userPos = { lat: position.coords.latitude, lng: position.coords.longitude };
                        currentUserLocation = userPos;
                        console.log(">>> [Traçar Rota Clicado] Localização obtida:", userPos);
                        updateUserMarkerAndAccuracy(position);

                        console.log(">>> [Traçar Rota Clicado] Preparando cálculo da rota...");
                        if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });

                        const MAX_ALLOWED_WAYPOINTS = 10;
                        const markersForRoute = foundMarkers.slice(0, MAX_ALLOWED_WAYPOINTS + 1);
                        console.log(`>>> [Traçar Rota Clicado] Limitando a ${markersForRoute.length} locais.`);
                        const waypointsLimited = markersForRoute.map(m => ({ location: m.getPosition(), stopover: true }));

                        let originPoint = userPos;
                        let destinationPoint;
                        let waypointsForRequest = [];

                        if (waypointsLimited.length === 0) { alert("Erro interno: Nenhum marcador válido."); this.disabled = false; this.textContent = "Traçar Rota"; return; }
                        else if (waypointsLimited.length === 1) { destinationPoint = waypointsLimited[0].location; }
                        else { destinationPoint = waypointsLimited[waypointsLimited.length - 1].location; waypointsForRequest = waypointsLimited.slice(0, -1); }

                        const request = {
                            origin: originPoint, destination: destinationPoint, waypoints: waypointsForRequest,
                            optimizeWaypoints: true, // <<< OTIMIZAÇÃO LIGADA (como no seu original)
                            travelMode: google.maps.TravelMode.DRIVING
                        };

                        console.log(">>> [Traçar Rota Clicado] Enviando requisição de rota:", request);
                        directionsService.route(request, (result, status) => {
                            if (status === google.maps.DirectionsStatus.OK) {
                                console.log(">>> [Traçar Rota Clicado] Rota calculada com SUCESSO.");
                                directionsRenderer.setDirections(result);
                                currentRouteResult = result; // Guarda resultado
                                currentRouteRequest = request; // Guarda requisição
                                isRecalculating = false;

                                console.log(">>> [Traçar Rota Clicado] Entrando no Modo Mapa...");
                                if (appContainer) {
                                    appContainer.classList.add('map-only-mode'); // <<< ATIVA MODO MAPA (JÁ ESTAVA AQUI)
                                    setTimeout(() => {
                                        if (map) {
                                            google.maps.event.trigger(map, 'resize');
                                            if (result.routes && result.routes[0] && result.routes[0].bounds) {
                                                 map.fitBounds(result.routes[0].bounds);
                                            }
                                            console.log(">>> [Traçar Rota Clicado] Mapa redimensionado.");
                                        }
                                    }, 350);
                                } else { console.warn(">>> [Traçar Rota Clicado] appContainer não encontrado."); }
                                this.textContent = "Rota Traçada";

                            } else {
                                console.error(`!!! [Traçar Rota Clicado] Erro ao calcular a rota: ${status}`);
                                alert(`Não foi possível calcular a rota: ${status}.`);
                                currentRouteResult = null; currentRouteRequest = null;
                                this.disabled = foundMarkers.length === 0; this.textContent = "Traçar Rota";
                            }
                        });

                    }, (error) => {
                        console.error("!!! [Traçar Rota Clicado] Erro ao obter localização:", error);
                        handleLocationError(error, false);
                        alert("Não foi possível obter sua localização para traçar a rota.");
                        this.disabled = foundMarkers.length === 0; this.textContent = "Traçar Rota";
                    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
                );
            } else {
                alert("Geolocalização não suportada."); this.disabled = foundMarkers.length === 0; this.textContent = "Traçar Rota";
            }
        });
    }

     // --- Listeners Manuais (Exatamente como você forneceu - desativados) ---
     if (addLocationBtn) { addLocationBtn.addEventListener('click', () => { alert("Adicionar manual desativado."); }); }
     if (selectedLocationsList) { /* ... listener remover desativado ... */ }

    // --- Listener Botão Voltar ( <<< MODIFICAÇÃO APLICADA AQUI >>> ) ---
    // Substituindo o alert("Botão Voltar será reativado...") pela lógica funcional.
    if (backButton && appContainer && routeFoundBtn) { // Condição garante que temos os elementos
        backButton.addEventListener('click', () => {
            console.log(">>> Botão Voltar (Mapa) clicado.");

            // 1. Limpar a rota visualmente
            if (directionsRenderer) {
                try {
                    directionsRenderer.setDirections({ routes: [] });
                    console.log(">>> Voltar (Mapa): Rota visual limpa.");
                } catch (e) { console.error(">>> Voltar (Mapa): Erro ao limpar directionsRenderer:", e); }
            } else { console.warn(">>> Voltar (Mapa): directionsRenderer não disponível para limpar."); }

            // 2. Remover o modo "mapa apenas" do container principal
            if (appContainer) {
                appContainer.classList.remove('map-only-mode'); // <<< REMOVE A CLASSE CSS
                console.log(">>> Voltar (Mapa): Classe 'map-only-mode' removida.");
            }

            // 3. Resetar o botão "Traçar Rota"
            if (routeFoundBtn) {
                routeFoundBtn.textContent = "Traçar Rota";
                // Reabilitar botão SOMENTE se ainda existirem marcadores da busca anterior
                routeFoundBtn.disabled = foundMarkers.length === 0;
                console.log(`>>> Voltar (Mapa): Botão 'Traçar Rota' resetado. Habilitado: ${!routeFoundBtn.disabled}`);
            }

            // 4. Limpar variáveis de estado da rota
            currentRouteResult = null;
            currentRouteRequest = null;
            isRecalculating = false;
            console.log(">>> Voltar (Mapa): Variáveis de estado da rota limpas.");

            // 5. Disparar redimensionamento do mapa (importante após mudança de layout)
            setTimeout(() => {
                try {
                    if (map) {
                       google.maps.event.trigger(map, 'resize');
                       console.log(">>> Voltar (Mapa): Evento 'resize' do mapa disparado.");
                       // Opcional: Poderíamos recentralizar ou ajustar o zoom aqui se necessário
                       // Ex: if (foundMarkers.length > 0) { /* fitBounds nos marcadores */ }
                    }
                } catch (e) { console.error(">>> Voltar (Mapa): Erro ao disparar resize do mapa:", e); }
            }, 100); // Pequeno delay

        });
    } else {
         // Log de erro se algum elemento essencial para o listener do botão Voltar não foi encontrado
         if (!backButton) console.error("Setup Listener Voltar: Botão #back-button não encontrado.");
         if (!appContainer) console.error("Setup Listener Voltar: #appContainer não encontrado.");
         if (!routeFoundBtn) console.error("Setup Listener Voltar: #route-found-btn não encontrado.");
    }
    // --- FIM DA MODIFICAÇÃO ---

    console.log(">>> setupEventListeners: Concluído.");
} // --- FIM DA FUNÇÃO setupEventListeners ---


// handleSearchResults (Exatamente como você forneceu, com verificação de bounds)
function handleSearchResults(results, status) {
    console.log(`>>> handleSearchResults: Status: "${status}". Resultados:`, results ? results.length : 0);

    clearFoundMarkers();

    if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
        let bounds = new google.maps.LatLngBounds();
        let validCount = 0;
        results.forEach((place, index) => {
            if (place.name && place.geometry && place.geometry.location) {
                console.log(`   - Adicionando Marcador ${index + 1}: ${place.name}`);
                try {
                     const marker = new google.maps.Marker({ position: place.geometry.location, map: map, title: place.name });
                     foundMarkers.push(marker);
                     bounds.extend(place.geometry.location);
                     validCount++;
                } catch(e) { console.error(`Erro ao criar marcador para ${place.name}:`, e); }
            } else { console.log(`   - Resultado ${index + 1}: Inválido.`); }
        });

        if (validCount > 0) {
             console.log(`>>> handleSearchResults: ${validCount} marcadores adicionados.`);
             if (currentUserLocation) bounds.extend(currentUserLocation);
             // Verificação para evitar erro se bounds estiver vazio
             if (!bounds.isEmpty()) {
                 try {
                     map.fitBounds(bounds);
                     const listener = google.maps.event.addListenerOnce(map, 'idle', () => {
                          if (map.getZoom() > 16) map.setZoom(16);
                     });
                     setTimeout(() => google.maps.event.removeListener(listener), 1000); // Timeout de segurança
                 } catch (e) { console.error("Erro em fitBounds/setZoom:", e); }
             } else {
                 console.warn(">>> handleSearchResults: Bounds vazio, não chamando fitBounds.");
             }
             if (routeFoundBtn) routeFoundBtn.disabled = false; console.log(">>> handleSearchResults: Botão Traçar Rota HABILITADO.");
        } else {
            console.log(">>> handleSearchResults: Nenhum marcador válido criado.");
            if (routeFoundBtn) routeFoundBtn.disabled = true;
        }
    } else {
        console.warn(`>>> handleSearchResults: Sem resultados ou erro. Status: ${status}`);
        if (routeFoundBtn) routeFoundBtn.disabled = true;
     }
    console.log(">>> handleSearchResults: FIM.");
}

// clearFoundMarkers (Exatamente como você forneceu)
function clearFoundMarkers() {
    console.log(`>>> clearFoundMarkers: Iniciando limpeza. ${foundMarkers ? `Limpando ${foundMarkers.length} marcadores.` : 'Array inválido.'}`);
    if (foundMarkers && Array.isArray(foundMarkers) && foundMarkers.length > 0) {
         try {
              foundMarkers.forEach((marker) => { if (marker && typeof marker.setMap === 'function') { marker.setMap(null); } });
              console.log(`>>> clearFoundMarkers: Marcadores removidos.`);
         } catch (e) { console.error(`>>> clearFoundMarkers: Erro ao remover:`, e); }
    }
    foundMarkers = [];
    if (routeFoundBtn) { routeFoundBtn.disabled = true; }
    console.log(`>>> clearFoundMarkers: Limpeza concluída.`);
}

// Chamada inicial (Exatamente como você forneceu)
console.log("Aguardando API do Google Maps chamar initMap...");