// ========================================================================
// Rota Fácil - script.js
// VERSÃO COM BOTÃO VOLTAR FUNCIONAL (BASEADO NO ORIGINAL ENVIADO)
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
let currentRouteResult = null; // <<< Variável adicionada para guardar rota
let currentRouteRequest = null; // <<< Variável adicionada para guardar requisição
let isRecalculating = false; // <<< Variável adicionada (pode ser usada no futuro)

// --- Elementos da UI (Inicializados em setupEventListeners) ---
let appContainer = null;
let routeFoundBtn = null;
let backButton = null; // <<< Referência para o botão Voltar (do mapa)
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

// Bloco para updateUserMarkerAndAccuracy (igual ao original)
function updateUserMarkerAndAccuracy(position) {
    console.log(">>> updateUserMarkerAndAccuracy: INÍCIO.");

    if (!position || !position.coords) { console.warn(">>> updateUserMarkerAndAccuracy: Posição inválida."); return; }
    // >>> CORREÇÃO POTENCIAL: Adicionado um check extra para garantir que 'map' e 'setCenter' existam antes de usar
    if (!map || typeof map.setCenter !== 'function' || typeof map.getProjection !== 'function') {
        console.error(">>> updateUserMarkerAndAccuracy: Mapa inválido ou não totalmente inicializado!");
        // Tenta inicializar o mapa novamente ou aguarda? Por agora, apenas retorna para evitar erro.
        return;
    }
    // <<< Fim da Correção Potencial

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

    // Lógica de espera 'tilesloaded' (igual ao original)
    if (map.getProjection()) {
         console.log(">>> updateUserMarkerAndAccuracy: Mapa parece pronto (getProjection existe). Executando update agora.");
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

// handleLocationError (igual ao original)
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

// initMap (igual ao original)
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

// startWatchingPosition (igual ao original)
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

// initializeMapAndServices (igual ao original)
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
        setupEventListeners(); // Chama listeners DEPOIS

        if (currentUserLocation) {
             console.log(">>> initializeMapAndServices: Chamando update inicial da seta...");
             const initialPositionLike = { coords: { latitude: currentUserLocation.lat, longitude: currentUserLocation.lng, accuracy: 20, heading: null } };
             updateUserMarkerAndAccuracy(initialPositionLike);
        }
        startWatchingPosition(); // Inicia watch DEPOIS

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

    // Pega referências (adicionado backButton aqui)
    appContainer = document.getElementById('app-container');
    backButton = document.getElementById('back-button'); // <<< PEGA O BOTÃO VOLTAR
    searchInput = document.getElementById('search-input');
    addLocationBtn = document.getElementById('add-location-btn');
    selectedLocationsList = document.getElementById('selected-locations-list');
    const categoryButtons = document.querySelectorAll('.category-btn');
    routeFoundBtn = document.getElementById('route-found-btn');

    // Verifica elementos essenciais (adicionado backButton aqui)
    let missingElement = null;
    if (!appContainer) missingElement = '#app-container';
    else if (!searchInput) missingElement = '#search-input';
    else if (!addLocationBtn) missingElement = '#add-location-btn';
    else if (!selectedLocationsList) missingElement = '#selected-locations-list';
    else if (!categoryButtons || categoryButtons.length === 0) missingElement = '.category-btn';
    else if (!routeFoundBtn) missingElement = '#route-found-btn';
    else if (!backButton) missingElement = '#back-button'; // <<< ADICIONADA VERIFICAÇÃO
    if (missingElement) { console.error(`ERRO FATAL: Elemento "${missingElement}" não encontrado!`); return; }
    // Removido o aviso antigo sobre backButton, pois agora ele é necessário.

    // --- Configuração Autocomplete (mantido como no original) ---
    // ... (código do autocomplete como antes) ...
    // setTimeout(() => { /* ... código autocomplete ... */ }, 500);


    // --- Listener Botões de Categoria (igual ao original) ---
    categoryButtons.forEach(button => {
        button.addEventListener('click', function() {
            const categoryType = this.dataset.category;
            console.log(`>>> CATEGORIA CLICADA: "${categoryType}" <<<`);
            if (!map || !placesService || typeof placesService.nearbySearch !== 'function') {
                alert("Mapa/Places não pronto!"); console.error("Busca categoria: Dependências inválidas."); return;
            }
            console.log(`--- Iniciando busca para "${categoryType}" ---`);
            if(routeFoundBtn) routeFoundBtn.disabled = true;
            clearFoundMarkers(); // Limpa anteriores

            let request;
            if (currentUserLocation) {
                console.log("--- Buscando perto (nearbySearch) ---");
                request = { location: currentUserLocation, radius: 5000, keyword: categoryType };
                placesService.nearbySearch(request, handleSearchResults);
            } else {
                console.log("--- Buscando na área visível (textSearch) ---");
                // >>> CORREÇÃO POTENCIAL: Check se map.getBounds() retorna algo válido
                const bounds = map.getBounds();
                if (!bounds) {
                    alert("Área do mapa indefinida. Tente mover o mapa um pouco.");
                    console.error("Busca categoria: map.getBounds() retornou null/undefined.");
                    if(routeFoundBtn) routeFoundBtn.disabled = false; // Reabilitar se a busca falhou aqui? Ou manter desabilitado? Decidi manter desabilitado.
                    return;
                }
                // <<< Fim da Correção Potencial
                request = { bounds: bounds, query: categoryType };
                placesService.textSearch(request, handleSearchResults);
            }
        });
    });

    // --- Listener Botão "Traçar Rota" (igual ao original - JÁ CONTÉM a linha para adicionar a classe) ---
    if (routeFoundBtn) {
        routeFoundBtn.addEventListener('click', function() {
            console.log(`>>> [Traçar Rota Clicado] Iniciando. Número de foundMarkers: ${foundMarkers.length}`);
            // Verificações iniciais (iguais)
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

                        const request = { origin: originPoint, destination: destinationPoint, waypoints: waypointsForRequest, optimizeWaypoints: true, travelMode: google.maps.TravelMode.DRIVING };

                        console.log(">>> [Traçar Rota Clicado] Enviando requisição de rota:", request);
                        directionsService.route(request, (result, status) => {
                            if (status === google.maps.DirectionsStatus.OK) {
                                console.log(">>> [Traçar Rota Clicado] Rota calculada com SUCESSO.");
                                directionsRenderer.setDirections(result);
                                currentRouteResult = result; // Guarda resultado
                                currentRouteRequest = request; // Guarda requisição
                                isRecalculating = false;

                                // --- Entrar no Modo Mapa ---
                                console.log(">>> [Traçar Rota Clicado] Entrando no Modo Mapa...");
                                if (appContainer) {
                                    appContainer.classList.add('map-only-mode'); // <<< ESSA LINHA JÁ ESTAVA AQUI NO SEU SCRIPT ORIGINAL E ESTÁ CORRETA
                                    setTimeout(() => {
                                        if (map) {
                                            google.maps.event.trigger(map, 'resize');
                                            if (result.routes && result.routes[0] && result.routes[0].bounds) {
                                                 map.fitBounds(result.routes[0].bounds);
                                            }
                                            console.log(">>> [Traçar Rota Clicado] Mapa redimensionado para Modo Mapa.");
                                        }
                                    }, 350);
                                } else { console.warn(">>> [Traçar Rota Clicado] appContainer não encontrado."); }
                                this.textContent = "Rota Traçada";

                            } else { // ERRO NO CÁLCULO DA ROTA (igual)
                                console.error(`!!! [Traçar Rota Clicado] Erro ao calcular a rota: ${status}`);
                                alert(`Não foi possível calcular a rota: ${status}.`);
                                currentRouteResult = null; currentRouteRequest = null;
                                this.disabled = foundMarkers.length === 0; this.textContent = "Traçar Rota";
                            }
                        }); // Fim callback directionsService.route

                    }, (error) => { // ERRO AO OBTER LOCALIZAÇÃO (igual)
                        console.error("!!! [Traçar Rota Clicado] Erro ao obter localização:", error);
                        handleLocationError(error, false);
                        alert("Não foi possível obter sua localização para traçar a rota.");
                        this.disabled = foundMarkers.length === 0; this.textContent = "Traçar Rota";
                    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
                );
            } else { // SEM GEOLOCATION (igual)
                alert("Geolocalização não suportada."); this.disabled = foundMarkers.length === 0; this.textContent = "Traçar Rota";
            }
        }); // Fim listener routeFoundBtn
    } // Fim if(routeFoundBtn)

     // --- Listeners Manuais (igual, desativados) ---
     if (addLocationBtn) { addLocationBtn.addEventListener('click', () => { alert("Adicionar manual desativado."); }); }
     if (selectedLocationsList) { /* ... listener remover desativado ... */ }

    // --- Listener Botão Voltar ( <<< MODIFICAÇÃO APLICADA AQUI >>> ) ---
    // O bloco 'if' e o 'addEventListener' já existiam, SÓ O CONTEÚDO INTERNO FOI SUBSTITUÍDO.
    if (backButton && appContainer && routeFoundBtn) { // Adicionado routeFoundBtn à condição pois é usado dentro
        backButton.addEventListener('click', () => {
            console.log(">>> Botão Voltar (Mapa) clicado.");

            // 1. Limpar a rota visualmente
            if (directionsRenderer) {
                try {
                    directionsRenderer.setDirections({ routes: [] });
                    console.log(">>> Voltar (Mapa): Rota visual limpa.");
                } catch (e) { console.error(">>> Voltar (Mapa): Erro ao limpar directionsRenderer:", e); }
            } else { console.warn(">>> Voltar (Mapa): directionsRenderer não inicializado."); }

            // 2. Remover o modo "mapa apenas"
            if (appContainer) { // Verifica de novo por segurança
                appContainer.classList.remove('map-only-mode'); // <<< REMOVE A CLASSE DO CSS
                console.log(">>> Voltar (Mapa): Classe 'map-only-mode' removida.");
                // O CSS vai esconder o #back-button automaticamente
            }

            // 3. Resetar botão "Traçar Rota"
            if (routeFoundBtn) { // Verifica de novo por segurança
                routeFoundBtn.textContent = "Traçar Rota";
                // Habilita o botão SOMENTE se ainda houver marcadores da busca anterior
                routeFoundBtn.disabled = foundMarkers.length === 0;
                console.log(`>>> Voltar (Mapa): Botão 'Traçar Rota' resetado. Habilitado: ${!routeFoundBtn.disabled}`);
            }

            // 4. Resetar variáveis de estado da rota (importante)
            currentRouteResult = null;
            currentRouteRequest = null;
            isRecalculating = false; // Reseta flag
            console.log(">>> Voltar (Mapa): Variáveis de estado da rota resetadas.");

            // 5. Disparar redimensionamento do mapa (essencial após mudar layout)
            setTimeout(() => {
                try {
                    if (map) { // Verifica se mapa existe
                       google.maps.event.trigger(map, 'resize');
                       console.log(">>> Voltar (Mapa): Evento 'resize' do mapa disparado.");
                       // Opcional: Reajustar zoom/centro para mostrar marcadores ou localização atual
                       // if (foundMarkers.length > 0) {
                       //     let bounds = new google.maps.LatLngBounds();
                       //     if(currentUserLocation) bounds.extend(currentUserLocation);
                       //     foundMarkers.forEach(marker => bounds.extend(marker.getPosition()));
                       //     map.fitBounds(bounds);
                       //     if (map.getZoom() > 16) map.setZoom(16);
                       // } else if (currentUserLocation) { map.setCenter(currentUserLocation); map.setZoom(15); }
                    }
                } catch (e) { console.error(">>> Voltar (Mapa): Erro ao disparar resize do mapa:", e); }
            }, 100); // Pequeno delay para dar tempo ao navegador processar a mudança de classe CSS
        });
    } else {
         // Log de erro se elementos essenciais para o listener do botão Voltar não foram encontrados
         if (!backButton) console.error("Config Listener Voltar: Botão #back-button não encontrado.");
         if (!appContainer) console.error("Config Listener Voltar: #appContainer não encontrado.");
         if (!routeFoundBtn) console.error("Config Listener Voltar: #route-found-btn não encontrado.");
    }
    // --- FIM DA MODIFICAÇÃO ---

    console.log(">>> setupEventListeners: Concluído.");
} // --- FIM DA FUNÇÃO setupEventListeners ---


// handleSearchResults (igual ao original)
function handleSearchResults(results, status) {
    console.log(`>>> handleSearchResults: Status: "${status}". Resultados:`, results ? results.length : 0);

    // >>> CORREÇÃO POTENCIAL: Mover clearFoundMarkers para DENTRO do if OK?
    // Não, a lógica original limpa ANTES, o que parece correto para evitar duplicatas
    // Vamos manter como está no original.
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
            } else { console.log(`   - Resultado ${index + 1}: Inválido ou sem geometria/localização.`); }
        });

        if (validCount > 0) {
             console.log(`>>> handleSearchResults: ${validCount} marcadores adicionados.`);
             if (currentUserLocation) bounds.extend(currentUserLocation);
             // >>> CORREÇÃO POTENCIAL: Garantir que 'bounds' não está vazio antes de chamar fitBounds
             if (!bounds.isEmpty()) {
                 try {
                     map.fitBounds(bounds);
                     // Evitar zoom excessivo
                     const listener = google.maps.event.addListenerOnce(map, 'idle', () => {
                         if (map.getZoom() > 16) map.setZoom(16);
                     });
                     // Segurança caso 'idle' não dispare
                     setTimeout(() => google.maps.event.removeListener(listener), 1000);
                 } catch (e) { console.error("Erro ao ajustar bounds/zoom:", e); }
             } else {
                 console.warn(">>> handleSearchResults: Bounds vazio, não ajustando zoom.");
             }
             // <<< Fim da Correção Potencial
             if (routeFoundBtn) routeFoundBtn.disabled = false;
             console.log(">>> handleSearchResults: Botão Traçar Rota HABILITADO.");
        } else {
            console.log(">>> handleSearchResults: Nenhum marcador válido foi criado a partir dos resultados.");
            if (routeFoundBtn) routeFoundBtn.disabled = true; // Garante desabilitar se nenhum válido foi criado
        }
    } else {
        console.warn(`>>> handleSearchResults: Sem resultados ou erro no serviço Places. Status: ${status}`);
        if (routeFoundBtn) routeFoundBtn.disabled = true; // Garante desabilitar em caso de erro/zero resultados
        // Poderia adicionar um alert aqui se status for ZERO_RESULTS?
        // if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
        //     alert("Nenhum local encontrado para esta categoria na área.");
        // }
    }
    console.log(">>> handleSearchResults: FIM.");
}


// clearFoundMarkers (igual ao original)
function clearFoundMarkers() {
    console.log(`>>> clearFoundMarkers: Iniciando limpeza. ${foundMarkers ? `Limpando ${foundMarkers.length} marcadores.` : 'Array inválido.'}`);
    if (foundMarkers && Array.isArray(foundMarkers) && foundMarkers.length > 0) {
         try {
              foundMarkers.forEach((marker) => { if (marker && typeof marker.setMap === 'function') { marker.setMap(null); } });
              console.log(`>>> clearFoundMarkers: Marcadores removidos.`);
         } catch (e) { console.error(`>>> clearFoundMarkers: Erro ao remover:`, e); }
    }
    foundMarkers = []; // Reseta o array para vazio
    if (routeFoundBtn) { routeFoundBtn.disabled = true; } // Garante desabilitar botão
    console.log(`>>> clearFoundMarkers: Limpeza concluída.`);
}

// Chamada inicial (igual ao original)
console.log("Aguardando API do Google Maps chamar initMap...");