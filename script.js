// ========================================================================
// Rota Fácil - script.js
// VERSÃO LIMPA E CORRIGIDA - Foco: Seta e Categorias Consistentes
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

// --- Elementos da UI (Inicializados em setupEventListeners) ---
let appContainer = null;
let routeFoundBtn = null;
// ... (outros elementos podem ser adicionados aqui se precisarem ser globais)

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

// Bloco NOVO para updateUserMarkerAndAccuracy (com espera 'tilesloaded')
function updateUserMarkerAndAccuracy(position) {
    console.log(">>> updateUserMarkerAndAccuracy: INÍCIO.");

    if (!position || !position.coords) { console.warn(">>> updateUserMarkerAndAccuracy: Posição inválida."); return; }
    if (!map || typeof map.setCenter !== 'function') { console.error(">>> updateUserMarkerAndAccuracy: Mapa inválido!"); return; }

    const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
    currentUserLocation = pos; // Atualiza global PRIMEIRO
    const accuracy = position.coords.accuracy;
    const heading = position.coords.heading;

    console.log(">>> updateUserMarkerAndAccuracy: Mapa e posição OK. Definindo função para atualizar marcador/círculo...");

    // --- Função que faz a atualização visual ---
    const performVisualUpdate = () => {
        console.log(">>> updateUserMarkerAndAccuracy (performVisualUpdate): Executando atualização visual...");

        // --- Círculo de Precisão ---
        try {
            if (userLocationAccuracyCircle) {
                userLocationAccuracyCircle.setCenter(pos); userLocationAccuracyCircle.setRadius(accuracy);
            } else {
                console.log(">>> (performVisualUpdate): Criando NOVO círculo...");
                userLocationAccuracyCircle = new google.maps.Circle({ map: map, center: pos, radius: accuracy, strokeColor: '#1a73e8', strokeOpacity: 0.4, strokeWeight: 1, fillColor: '#1a73e8', fillOpacity: 0.1, zIndex: 1 });
            }
            console.log(">>> (performVisualUpdate): Círculo OK.");
        } catch(circleError) { console.error("!!! ERRO Círculo:", circleError); }

        // --- Marcador de Seta Azul ---
        console.log(">>> (performVisualUpdate): Preparando ícone da SETA AZUL...");
        let iconConfig = {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, fillColor: '#1a73e8', fillOpacity: 1,
            strokeColor: '#ffffff', strokeWeight: 2, scale: 6, anchor: new google.maps.Point(0, 2.5), rotation: 0
        };
        if (heading !== null && !isNaN(heading) && typeof heading === 'number') { iconConfig.rotation = heading; }

        try {
            if (userLocationMarker) { // Atualiza existente
                console.log(">>> (performVisualUpdate): Atualizando SETA existente...");
                userLocationMarker.setIcon(iconConfig);
                userLocationMarker.setPosition(pos);
                // Garante que está no mapa (ESSENCIAL após recarregar, caso o mapa tenha sido recriado)
                if (userLocationMarker.getMap() !== map) {
                     console.warn(">>> (performVisualUpdate): SETA não estava no mapa atual! Readicionando...");
                     userLocationMarker.setMap(map);
                }
                console.log(">>> (performVisualUpdate): SETA ATUALIZADA.");
            } else { // Cria nova
                console.log(">>> (performVisualUpdate): Criando NOVA SETA...");
                userLocationMarker = new google.maps.Marker({ position: pos, map: map, title: 'Sua localização', icon: iconConfig, zIndex: 2 });
                console.log(">>> (performVisualUpdate): NOVA SETA CRIADA.");
            }
        } catch (markerError) { console.error("!!! ERRO Marcador/Seta:", markerError); userLocationMarker = null; }

        console.log(">>> updateUserMarkerAndAccuracy (performVisualUpdate): FIM.");
    }; // Fim da função performVisualUpdate


    // --- Lógica de Espera pelo Mapa Pronto ---
    // Tenta verificar se o mapa já tem 'tiles' carregados (mais confiável que 'idle' às vezes)
    // Verifica se o método 'getProjection' existe, indica que o mapa está minimamente inicializado
    if (map.getProjection()) {
         console.log(">>> updateUserMarkerAndAccuracy: Mapa parece pronto (getProjection existe). Executando update agora.");
         performVisualUpdate();
    } else {
         // Se projeção não existe, espera pelo evento 'tilesloaded' (dispara quando os blocos do mapa carregam)
         console.warn(">>> updateUserMarkerAndAccuracy: Mapa ainda não parece pronto. Aguardando 'tilesloaded'...");
         const listener = google.maps.event.addListenerOnce(map, 'tilesloaded', () => {
              console.log(">>> updateUserMarkerAndAccuracy: Evento 'tilesloaded' disparado!");
              performVisualUpdate();
         });
         // Timeout de segurança caso 'tilesloaded' não dispare (raro, mas possível)
         setTimeout(() => {
              // Verifica se o listener ainda existe (significa que 'tilesloaded' não disparou)
              // e se o marcador ainda não foi criado
              if (listener && (!userLocationMarker || !userLocationMarker.getMap())) {
                   console.warn(">>> updateUserMarkerAndAccuracy: Timeout (3s) esperando 'tilesloaded'. Removendo listener e tentando update mesmo assim...");
                   google.maps.event.removeListener(listener); // Remove o listener para evitar execução dupla
                   performVisualUpdate();
              }
         }, 3000); // Espera 3 segundos
    }
    console.log(">>> updateUserMarkerAndAccuracy: FIM (update pode estar aguardando tilesloaded).");
}
// --- Fim do Bloco NOVO ---

/**
 * Lida com erros da API de Geolocalização.
 */
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

/**
 * Callback principal chamado pela API do Google Maps.
 */
function initMap() {
    console.log(">>> initMap: Iniciando...");

    // Garante que marcador/círculo comecem nulos nesta sessão
    userLocationMarker = null;
    userLocationAccuracyCircle = null;
    console.log(">>> initMap: Marcador/Círculo resetados para null.");

    if (navigator.geolocation) {
        console.log(">>> initMap: Tentando obter localização inicial...");
        navigator.geolocation.getCurrentPosition(
            (position) => { // SUCESSO INICIAL
                console.log(">>> initMap: Localização inicial OBTIDA.");
                currentUserLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
                initializeMapAndServices(currentUserLocation, 15); // Inicializa mapa/serviços
                // Chama update/watcher DEPOIS que mapa/serviços estão prontos (dentro de initializeMapAndServices)
            },
            (error) => { // ERRO INICIAL
                console.warn(">>> initMap: Erro ao obter localização inicial.");
                currentUserLocation = null;
                const defaultCoords = { lat: -23.5505, lng: -46.6333 }; // SP Padrão
                initializeMapAndServices(defaultCoords, 13); // Inicializa mapa/serviços
                handleLocationError(error, false);
                // Chama watcher DEPOIS (dentro de initializeMapAndServices)
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    } else { // Sem suporte a Geo
        console.warn(">>> initMap: Geolocalização não suportada.");
        currentUserLocation = null;
        const defaultCoords = { lat: -23.5505, lng: -46.6333 };
        initializeMapAndServices(defaultCoords, 13);
    }
}

/**
 * Inicia o monitoramento contínuo da localização (watchPosition).
 * CHAMADO DEPOIS que o mapa está pronto.
 */
function startWatchingPosition() {
     if (!navigator.geolocation) { console.warn(">>> startWatchingPosition: Geo não suportada."); return; }
     // Limpa watcher anterior
     if (watchId !== null) {
          console.warn(">>> startWatchingPosition: Limpando watchId anterior:", watchId);
          try { navigator.geolocation.clearWatch(watchId); } catch(e) { console.error(">>> startWatchingPosition: Erro ao limpar watchId anterior:", e); }
          watchId = null;
     }
     console.log(">>> startWatchingPosition: Tentando iniciar...");
     try {
         watchId = navigator.geolocation.watchPosition(
             (newPosition) => { // SUCESSO no watch
                 console.log("--- watchPosition: Sucesso. Chamando update...");
                 updateUserMarkerAndAccuracy(newPosition); // Chama a função da seta
             },
             (error) => { // ERRO no watch
                 console.error("!!! watchPosition: ERRO recebido:", error.code, error.message);
                 handleLocationError(error, true);
             },
             { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 } // Opções
         );
         console.log(`>>> startWatchingPosition: Iniciado com watchId: ${watchId}`);
     } catch (watchError) { console.error("!!! ERRO GERAL ao iniciar watchPosition:", watchError); watchId = null; }
 }

/**
 * Inicializa o mapa, PlacesService e chama outras inicializações.
 */
function initializeMapAndServices(initialCoords, initialZoom) {
    console.log(">>> initializeMapAndServices: Iniciando...");
    const mapDiv = document.getElementById('map-container');
    if (!mapDiv) { console.error("!!! ERRO CRÍTICO: #map-container não encontrado!"); return; }
    const loadingP = mapDiv.querySelector('p'); if (loadingP) loadingP.remove();

    try {
        console.log(">>> initializeMapAndServices: Criando mapa...");
        map = new google.maps.Map(mapDiv, { center: initialCoords, zoom: initialZoom }); // Sem mapId por enquanto
        console.log(">>> initializeMapAndServices: Mapa criado. Criando PlacesService...");
        placesService = new google.maps.places.PlacesService(map);
        console.log(">>> initializeMapAndServices: PlacesService criado.");
        // Adicionando inicialização do DirectionsService e DirectionsRenderer
console.log(">>> initializeMapAndServices: Criando DirectionsService/Renderer...");
directionsService = new google.maps.DirectionsService();
directionsRenderer = new google.maps.DirectionsRenderer({ map: map, suppressMarkers: false });
console.log(">>> initializeMapAndServices: Directions criados.");

        
        console.log(">>> initializeMapAndServices: Serviços Google prontos.");

        // Chama setup dos listeners DEPOIS que tudo está pronto
        setupEventListeners();

        // Chama update da seta com a localização inicial (se disponível) DEPOIS que mapa está pronto
        if (currentUserLocation) {
             console.log(">>> initializeMapAndServices: Chamando update inicial da seta...");
             // Simula um objeto position para a função
             const initialPositionLike = { coords: { latitude: currentUserLocation.lat, longitude: currentUserLocation.lng, accuracy: 20, heading: null } };
             updateUserMarkerAndAccuracy(initialPositionLike);
        }

        // Inicia o watchPosition DEPOIS que mapa está pronto
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

    // Pega referências DEPOIS que o mapa (e DOM) devem estar prontos
    appContainer = document.getElementById('app-container');
    const backButton = document.getElementById('back-button');
    const searchInput = document.getElementById('search-input');
    const addLocationBtn = document.getElementById('add-location-btn');
    const selectedLocationsList = document.getElementById('selected-locations-list');
    const categoryButtons = document.querySelectorAll('.category-btn');
    routeFoundBtn = document.getElementById('route-found-btn'); // Atribui à variável global

    // Verifica elementos essenciais
    let missingElement = null;
    if (!appContainer) missingElement = '#app-container';
    else if (!searchInput) missingElement = '#search-input';
    else if (!addLocationBtn) missingElement = '#add-location-btn';
    else if (!selectedLocationsList) missingElement = '#selected-locations-list';
    else if (!categoryButtons || categoryButtons.length === 0) missingElement = '.category-btn';
    else if (!routeFoundBtn) missingElement = '#route-found-btn';
    if (missingElement) { console.error(`ERRO FATAL: Elemento "${missingElement}" não encontrado!`); return; }
    if (!backButton) { console.warn("AVISO: Botão #back-button não encontrado."); }

    // --- Configuração Autocomplete (SIMPLIFICADO - Placeholder) ---
    // O código real do Autocomplete será adicionado na etapa correta
    // setTimeout(() => { /* ... código autocomplete ... */ }, 500);


    // --- Listener Botões de Categoria ---
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
                if (!map.getBounds()) { alert("Área do mapa indefinida."); return; }
                request = { bounds: map.getBounds(), query: categoryType };
                placesService.textSearch(request, handleSearchResults);
            }
        });
    });

    // --- Listener Botão "Traçar Rota" (Original, com modo mapa) ---
    if (routeFoundBtn) {
        routeFoundBtn.addEventListener('click', function() {
            console.log(`>>> [Traçar Rota Clicado] Iniciando. Número de foundMarkers: ${foundMarkers.length}`);

            // --- Verificações Iniciais ---
            if (!directionsService || !directionsRenderer) {
                alert("ERRO: Serviço de rotas (Directions) não está pronto."); return;
            }
            if (!foundMarkers || foundMarkers.length === 0) {
                alert("Nenhum local encontrado para incluir na rota."); return;
            }
            if (!map || typeof map.setCenter !== 'function') {
                 alert("ERRO: Mapa não está pronto."); return;
            }

            console.log(">>> [Traçar Rota Clicado] Verificações OK. Solicitando localização...");
            this.disabled = true; this.textContent = "Localizando...";

            // --- Solicita Localização Atual ---
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => { // SUCESSO ao obter localização
                        this.textContent = "Calculando Rota...";
                        const userPos = { lat: position.coords.latitude, lng: position.coords.longitude };
                        currentUserLocation = userPos;
                        console.log(">>> [Traçar Rota Clicado] Localização obtida:", userPos);
                        updateUserMarkerAndAccuracy(position);

                        // --- Prepara e Calcula a Rota ---
                        console.log(">>> [Traçar Rota Clicado] Preparando cálculo da rota...");
                        if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });

                        // LIMITA WAYPOINTS
                        const MAX_ALLOWED_WAYPOINTS = 10;
                        const markersForRoute = foundMarkers.slice(0, MAX_ALLOWED_WAYPOINTS + 1);
                        console.log(`>>> [Traçar Rota Clicado] Limitando a ${markersForRoute.length} locais.`);
                        const waypointsLimited = markersForRoute.map(m => ({ location: m.getPosition(), stopover: true }));

                        let originPoint = userPos;
                        let destinationPoint;
                        let waypointsForRequest = [];

                        if (waypointsLimited.length === 0) {
                             alert("Erro interno: Nenhum marcador válido para rota."); this.disabled = false; this.textContent = "Traçar Rota"; return;
                        } else if (waypointsLimited.length === 1) {
                             destinationPoint = waypointsLimited[0].location;
                        } else {
                             destinationPoint = waypointsLimited[waypointsLimited.length - 1].location;
                             waypointsForRequest = waypointsLimited.slice(0, -1);
                        }

                        const request = {
                            origin: originPoint, destination: destinationPoint, waypoints: waypointsForRequest,
                            optimizeWaypoints: true, // Otimização LIGADA (original)
                            travelMode: google.maps.TravelMode.DRIVING
                        };

                        console.log(">>> [Traçar Rota Clicado] Enviando requisição de rota:", request);
                        directionsService.route(request, (result, status) => { // Callback da Rota
                            if (status === google.maps.DirectionsStatus.OK) {
                                console.log(">>> [Traçar Rota Clicado] Rota calculada com SUCESSO.");
                                directionsRenderer.setDirections(result);
                                // As variáveis currentRouteResult/Request SÃO definidas aqui no original
                                currentRouteResult = result;
                                currentRouteRequest = request;
                                isRecalculating = false;

                                // --- Entrar no Modo Mapa ---
                                console.log(">>> [Traçar Rota Clicado] Entrando no Modo Mapa...");
                                if (appContainer) {
                                    appContainer.classList.add('map-only-mode'); // ATIVA MODO MAPA
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

                            } else { // ERRO NO CÁLCULO DA ROTA
                                console.error(`!!! [Traçar Rota Clicado] Erro ao calcular a rota: ${status}`);
                                alert(`Não foi possível calcular a rota: ${status}.`);
                                currentRouteResult = null; currentRouteRequest = null;
                                this.disabled = foundMarkers.length === 0;
                                this.textContent = "Traçar Rota";
                            }
                        }); // Fim callback directionsService.route

                    }, (error) => { // ERRO AO OBTER LOCALIZAÇÃO NO CLIQUE
                        console.error("!!! [Traçar Rota Clicado] Erro ao obter localização:", error);
                        handleLocationError(error, false);
                        alert("Não foi possível obter sua localização para traçar a rota.");
                        this.disabled = foundMarkers.length === 0;
                        this.textContent = "Traçar Rota";
                    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
                ); // Fim getCurrentPosition
            } else { // Navegador não suporta geolocalização
                alert("Geolocalização não suportada.");
                this.disabled = foundMarkers.length === 0;
                this.textContent = "Traçar Rota";
            }
        }); // Fim listener routeFoundBtn
    } // Fim if(routeFoundBtn)

     // --- Listeners Manuais (Original - Desativado) ---
     if (addLocationBtn) { addLocationBtn.addEventListener('click', () => { alert("Adicionar manual desativado."); }); }
     if (selectedLocationsList) { /* ... listener remover desativado ... */ }

    // --- Listener Botão Voltar (Original - Desativado) ---
    if (backButton && appContainer) {
        backButton.addEventListener('click', () => {
             alert("Botão Voltar será reativado na próxima etapa.");
             console.log("Botão Voltar clicado (funcionalidade pendente).");
            // Futuro: Reintroduzir lógica de remover classe, limpar rota, redimensionar.
        });
    }

    console.log(">>> setupEventListeners: Concluído.");
} // --- FIM DA FUNÇÃO setupEventListeners ---


/**
 * Callback para processar resultados da busca por categoria.
 * Adiciona marcadores SIMPLES (pinos padrão).
 */
function handleSearchResults(results, status) {
    console.log(`>>> handleSearchResults: Status: "${status}". Resultados:`, results ? results.length : 0);

    clearFoundMarkers(); // Limpa DE NOVO antes de adicionar (garantia extra no original)

    if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
        let bounds = new google.maps.LatLngBounds();
        let validCount = 0;
        results.forEach((place, index) => {
            if (place.name && place.geometry && place.geometry.location) {
                console.log(`   - Adicionando Marcador ${index + 1}: ${place.name}`);
                try {
                     // Usa marcador PADRÃO por enquanto
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
             // Verificação extra adicionada por segurança
             if (!bounds.isEmpty()) {
                 try { map.fitBounds(bounds); if (map.getZoom() > 16) map.setZoom(16); }
                 catch (e) { console.error("Erro fitBounds:", e); }
             }
             if (routeFoundBtn) routeFoundBtn.disabled = false; console.log(">>> handleSearchResults: Botão Traçar Rota HABILITADO.");
        } else {
            console.log(">>> handleSearchResults: Nenhum marcador válido criado.");
            if (routeFoundBtn) routeFoundBtn.disabled = true; // Desabilita se nenhum foi adicionado
         }
    } else {
         console.warn(`>>> handleSearchResults: Sem resultados ou erro. Status: ${status}`);
         if (routeFoundBtn) routeFoundBtn.disabled = true; // Desabilita em caso de erro
     }
    console.log(">>> handleSearchResults: FIM.");
}

/**
 * Limpa marcadores da busca por categoria e desabilita botão Traçar Rota.
 */
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

// Chamada inicial (via callback da API do Google Maps)
console.log("Aguardando API do Google Maps chamar initMap...");