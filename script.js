// ========================================================================
// Rota Fácil - script.js
// VERSÃO CORRIGIDA FINAL (Esperamos!) - Seta/Watch + Busca Categoria Simplificada
// ========================================================================

// --- Variáveis Globais ---
let map;
let placesService;
let directionsService = null;     // Desativado nesta versão
let directionsRenderer = null;    // Desativado nesta versão
let foundMarkers = [];            // Guarda marcadores da busca por categoria
let currentUserLocation = null;   // Guarda coords {lat, lng} do usuário
let userLocationMarker = null;    // Guarda o objeto Marker da seta do usuário
let userLocationAccuracyCircle = null; // Guarda o objeto Circle da precisão
let watchId = null;               // Guarda o ID do watchPosition
let appContainer = null;          // Referência ao div principal
// Variáveis não usadas nesta versão simplificada:
// const markers = [];
// let currentRouteResult = null;
// let currentRouteRequest = null;
// let isRecalculating = false;
// const ROUTE_DEVIATION_TOLERANCE = 50;
// let selectedPlaceData = null;


// --- Reset Inicial Garantido das Variáveis Globais ao Carregar ---
userLocationMarker = null;
userLocationAccuracyCircle = null;
if (navigator.geolocation && typeof watchId !== 'undefined' && watchId !== null) {
    console.log(">>> Script Init: Limpando watchId pré-existente:", watchId);
    try { navigator.geolocation.clearWatch(watchId); } catch (e) { console.error(">>> Script Init: Erro ao limpar watchId:", e); }
}
watchId = null;
foundMarkers = []; // Garante que começa vazio
console.log(">>> Script Init: Variáveis globais resetadas (marcador, círculo, watchId, foundMarkers).");
// -----------------------------------------------------------------


/**
 * Cria/Atualiza o marcador de seta e círculo de precisão do usuário.
 */
// Bloco NOVO para updateUserMarkerAndAccuracy (com espera 'idle')
function updateUserMarkerAndAccuracy(position) {
    console.log(">>> updateUserMarkerAndAccuracy: INÍCIO. Verificando posição...");

    if (!position || !position.coords) {
         console.warn(">>> updateUserMarkerAndAccuracy: Posição inválida. Abortando."); return;
    }
    const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
    const accuracy = position.coords.accuracy;
    const heading = position.coords.heading;

    // Verifica se a variável 'map' existe
    if (!map || typeof map.setCenter !== 'function') {
        console.error(">>> updateUserMarkerAndAccuracy: ERRO - Variável 'map' inválida ou não inicializada!"); return;
    }
    console.log(">>> updateUserMarkerAndAccuracy: Variável 'map' OK. Verificando se mapa está 'idle'...");

    // --- VERIFICAÇÃO E ESPERA PELO EVENTO 'IDLE' DO MAPA ---
    // O evento 'idle' garante que o mapa terminou de carregar/mover/zoomear
    // Isso pode ajudar se a função for chamada antes do mapa estar 100% pronto após recarregar

    // Define a função que realmente atualiza o marcador
    const doMarkerUpdate = () => {
       // Bloco NOVO para o conteúdo INTERNO de doMarkerUpdate
const doMarkerUpdate = () => {
    console.log(">>> updateUserMarkerAndAccuracy (doMarkerUpdate): Iniciando atualização de círculo e marcador...");

    // --- Círculo de Precisão (Mesmo de antes) ---f
    try {
        if (userLocationAccuracyCircle) {
            userLocationAccuracyCircle.setCenter(pos); userLocationAccuracyCircle.setRadius(accuracy);
        } else {
            userLocationAccuracyCircle = new google.maps.Circle({ map: map, center: pos, radius: accuracy, strokeColor: '#1a73e8', strokeOpacity: 0.4, strokeWeight: 1, fillColor: '#1a73e8', fillOpacity: 0.1, zIndex: 1 });
        }
        console.log(">>> updateUserMarkerAndAccuracy (doMarkerUpdate): Círculo OK.");
    } catch(circleError) { console.error("!!! ERRO Círculo:", circleError); }

    // Bloco NOVO (Usando Ícone Padrão - Pin Vermelho)
// --- Marcador Padrão (Pin Vermelho - Teste) ---
console.log(">>> updateUserMarkerAndAccuracy (doMarkerUpdate): Definindo iconConfig como NULL para usar ícone padrão...");
let iconConfig = null; // <<< Define como null para usar o ícone padrão do Google Maps

// A lógica de rotação não se aplica ao ícone padrão, então é removida/ignorada.
console.log(">>> updateUserMarkerAndAccuracy (doMarkerUpdate): Rotação ignorada (ícone padrão).");
// --- Fim do Bloco NOVO ---

    try {
        if (userLocationMarker) { // Se o marcador JÁ existe
            console.log(">>> updateUserMarkerAndAccuracy (doMarkerUpdate): Atualizando marcador existente...");
            // Tenta definir o ÍCONE PRIMEIRO e DEPOIS a posição
            userLocationMarker.setIcon(iconConfig);
            userLocationMarker.setPosition(pos);
             // Garante que está no mapa
             if(userLocationMarker.getMap() == null) { userLocationMarker.setMap(map); console.warn(">>> (doMarkerUpdate): Marcador readicionado ao mapa."); }
            console.log(">>> updateUserMarkerAndAccuracy (doMarkerUpdate): Marcador existente ATUALIZADO.");
        } else { // Se o marcador NÃO existe
            console.log(">>> updateUserMarkerAndAccuracy (doMarkerUpdate): Criando NOVO marcador...");
            userLocationMarker = new google.maps.Marker({
                position: pos,
                map: map,
                title: 'Sua localização',
                icon: iconConfig, // Usa o iconConfig definido acima
                zIndex: 2
            });
            console.log(">>> updateUserMarkerAndAccuracy (doMarkerUpdate): NOVO marcador CRIADO com sucesso.");
        }
    } catch (markerError) {
        console.error("!!! ERRO ao criar/atualizar Marcador (Seta):", markerError);
        userLocationMarker = null; // Reseta se deu erro
    }

    currentUserLocation = pos; // Atualiza localização global
    console.log(">>> updateUserMarkerAndAccuracy (doMarkerUpdate): FIM da atualização.");
}; // --- Fim do Bloco NOVO ---

    // Verifica se o mapa já está 'idle' (usando uma propriedade interna - não oficial, mas comum)
    // Ou se o 'getBounds' retorna algo (indicando que o mapa tem dimensões)
    if (map.__gm && map.__gm.map && map.__gm.map.getMapTypeId() && map.getBounds()) { // Tenta verificar se já está pronto
         console.log(">>> updateUserMarkerAndAccuracy: Mapa parece já estar 'idle' ou pronto. Executando update diretamente.");
         doMarkerUpdate(); // Executa imediatamente
    } else {
         // Se não parece pronto, espera pelo evento 'idle' UMA VEZ
         console.warn(">>> updateUserMarkerAndAccuracy: Mapa não parece 'idle'. Aguardando evento 'idle'...");
         google.maps.event.addListenerOnce(map, 'idle', () => {
              console.log(">>> updateUserMarkerAndAccuracy: Evento 'idle' disparado!");
              doMarkerUpdate(); // Executa quando o mapa ficar pronto
         });
         // Timeout de segurança: se 'idle' não disparar em X segundos, tenta mesmo assim
         setTimeout(() => {
              if (!userLocationMarker || userLocationMarker.getMap() === null) { // Só tenta se o marcador ainda não foi criado/adicionado
                   console.warn(">>> updateUserMarkerAndAccuracy: Timeout de segurança (5s) atingido após esperar 'idle'. Tentando update mesmo assim...");
                   doMarkerUpdate();
              }
         }, 5000); // Espera 5 segundos no máximo
    }
    // A função principal termina aqui, o update real acontece dentro de doMarkerUpdate (imediatamente ou após 'idle')
    console.log(">>> updateUserMarkerAndAccuracy: Lógica principal concluída (update pode estar aguardando 'idle').");
}
// --- Fim do Bloco NOVO ---

/**
 * Lida com erros da API de Geolocalização.
 */
function handleLocationError(error, isWatching) {
    let prefix = isWatching ? 'Erro Watch' : 'Erro Get';
    let message = `${prefix}: `;
    switch(error.code) {
       case error.PERMISSION_DENIED: message += "Permissão negada."; break;
       case error.POSITION_UNAVAILABLE: message += "Localização indisponível."; break;
       case error.TIMEOUT: message += "Tempo esgotado."; break;
       default: message += `Erro ${error.code}.`; break;
    }
    console.warn(message, error.message);

    // Limpa tudo se permissão negada durante watch
    if (isWatching && error.code === error.PERMISSION_DENIED) {
       console.warn(">>> handleLocationError: Permissão negada durante watch. Limpando tudo.");
       if (userLocationMarker) { try { userLocationMarker.setMap(null); } catch(e){} userLocationMarker = null; console.log("   - Marcador limpo."); }
       if (userLocationAccuracyCircle) { try { userLocationAccuracyCircle.setMap(null); } catch(e){} userLocationAccuracyCircle = null; console.log("   - Círculo limpo."); }
       if (watchId !== null) { try { navigator.geolocation.clearWatch(watchId); } catch(e){} watchId = null; console.log("   - WatchId parado e limpo."); }
    }
}

/**
 * Função de Callback principal - Chamada pela API Google Maps.
 */
function initMap() {
    console.log(">>> initMap: Iniciando...");
    function initMap() {
        console.log(">>> initMap: Iniciando...");
    
        // >>> ADICIONE ESTE BLOCO <<<
        // Tentativa de remover marcador antigo ANTES de qualquer coisa
        if (userLocationMarker && typeof userLocationMarker.setMap === 'function') {
             console.warn(">>> initMap: Tentando remover marcador pré-existente do mapa...");
             try {
                  userLocationMarker.setMap(null);
                  console.log(">>> initMap: Marcador pré-existente removido.");
             } catch(e) {
                  console.error(">>> initMap: Erro ao remover marcador pré-existente:", e);
             }
        }
        // Garante que a variável seja null ANTES de tentar obter localização
        userLocationMarker = null;
        console.log(">>> initMap: Variável userLocationMarker garantida como null.");
        // >>> FIM DO BLOCO ADICIONADO <<<
    
        if (navigator.geolocation) {
            // ... resto da função initMap continua aqui ...
        } // ... etc ...
    }
    if (navigator.geolocation) {
        console.log(">>> initMap: Tentando obter localização inicial...");
        navigator.geolocation.getCurrentPosition(
            (position) => { // SUCESSO
                console.log(">>> initMap: Localização inicial OBTIDA.");
                currentUserLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
                initializeMapAndServices(currentUserLocation, 15); // Inicializa mapa/serviços
                updateUserMarkerAndAccuracy(position); // Mostra seta inicial
                startWatchingPosition(); // Inicia monitoramento contínuo
            },
            (error) => { // ERRO
                console.warn(">>> initMap: Erro ao obter localização inicial.");
                currentUserLocation = null;
                const defaultCoords = { lat: -23.5505, lng: -46.6333 }; // SP Padrão
                initializeMapAndServices(defaultCoords, 13);
                handleLocationError(error, false);
                startWatchingPosition(); // Tenta iniciar mesmo sem loc inicial
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    } else { // Sem suporte a Geo
        console.warn(">>> initMap: Geolocalização não suportada."); /* ... inicializa com SP ... */
        const defaultCoords = { lat: -23.5505, lng: -46.6333 }; initializeMapAndServices(defaultCoords, 13);
    }
}

/**
 * Inicia o monitoramento contínuo da localização (watchPosition).
 */
function startWatchingPosition() {
     if (!navigator.geolocation) { console.warn(">>> startWatchingPosition: Geo não suportada."); return; }
     if (watchId !== null) { // Se já existe um, limpa antes
          console.warn(">>> startWatchingPosition: Limpando watchId anterior:", watchId);
          try { navigator.geolocation.clearWatch(watchId); } catch(e) { console.error(">>> startWatchingPosition: Erro ao limpar watchId anterior:", e); }
          watchId = null;
     }
     console.log(">>> startWatchingPosition: Tentando iniciar...");
     try {
         watchId = navigator.geolocation.watchPosition(
             (newPosition) => { // SUCESSO no watch
                 console.log("--- watchPosition: Sucesso. Chamando update...");
                 updateUserMarkerAndAccuracy(newPosition);
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
 * Inicializa o mapa e o PlacesService.
 */
function initializeMapAndServices(initialCoords, initialZoom) {
    console.log(">>> initializeMapAndServices: Iniciando...");
    const mapDiv = document.getElementById('map-container');
    if (!mapDiv) { console.error("!!! ERRO CRÍTICO: #map-container não encontrado!"); return; }
    const loadingP = mapDiv.querySelector('p'); if (loadingP) loadingP.remove();

    try {
        console.log(">>> initializeMapAndServices: Criando mapa...");
        // Bloco NOVO (sem mapId)
    map = new google.maps.Map(mapDiv, {
        center: coords,
        zoom: zoomLevel // Removemos mapId
        // mapId: "DEMO_MAP_ID" // Ou comente assim
    });
        console.log(">>> initializeMapAndServices: Mapa criado. Criando PlacesService...");
        placesService = new google.maps.places.PlacesService(map);
        console.log(">>> initializeMapAndServices: PlacesService criado.");
        console.log(">>> initializeMapAndServices: Serviços essenciais prontos.");

        setupEventListeners(); // <<<<<<< CHAMA A FUNÇÃO CORRETA DE SETUP

    } catch (error) {
        console.error("!!! ERRO ao inicializar mapa ou PlacesService:", error);
        if (mapDiv) { mapDiv.innerHTML = `<p style="color: red; padding: 20px;">ERRO: ${error.message}</p>`; }
    }
}

/**
 * Configura TODOS os listeners de eventos necessários.
 */
function setupEventListeners() { // <<<<<<< NOME CORRETO DA FUNÇÃO DE SETUP
    console.log(">>> setupEventListeners: Configurando...");

    appContainer = document.getElementById('app-container');
    const backButton = document.getElementById('back-button');
    const searchInput = document.getElementById('search-input'); // Necessário para Autocomplete
    const addLocationBtn = document.getElementById('add-location-btn'); // Necessário para Adicionar Manual
    const selectedLocationsList = document.getElementById('selected-locations-list'); // Necessário para Lista/Remover
    const categoryButtons = document.querySelectorAll('.category-btn');
    const routeFoundBtn = document.getElementById('route-found-btn'); // Necessário para Habilitar/Desabilitar

    // Verifica elementos essenciais
    let missingElement = null;
    if (!appContainer) missingElement = '#app-container';
    else if (!searchInput) missingElement = '#search-input'; // Verifica autocomplete input
    else if (!addLocationBtn) missingElement = '#add-location-btn'; // Verifica botão add
    else if (!selectedLocationsList) missingElement = '#selected-locations-list'; // Verifica lista
    else if (!categoryButtons || categoryButtons.length === 0) missingElement = '.category-btn';
    else if (!routeFoundBtn) missingElement = '#route-found-btn';

    if (missingElement) {
        console.error(`ERRO FATAL em setupEventListeners: Elemento essencial "${missingElement}" não encontrado!`);
        return; // Para a configuração
    }
    if (!backButton) { console.warn("AVISO: Botão #back-button não encontrado."); }

    // --- Configuração Autocomplete (SIMPLIFICADO - SEM AINDA USAR addSelectedPlaceToList) ---
    setTimeout(() => {
        if (map && google.maps.places) {
            try {
                const autocomplete = new google.maps.places.Autocomplete(searchInput);
                autocomplete.addListener('place_changed', () => {
                    const place = autocomplete.getPlace();
                    console.log('Autocomplete: place_changed:', place ? place.name : 'Inválido');
                    // selectedPlaceData = (place && place.geometry...) ? place : null; // Lógica completa depois
                });
                searchInput.addEventListener('input', () => { if (!searchInput.value) { /* selectedPlaceData = null; */ } });
                console.log("Autocomplete inicializado (simplificado).");
            } catch (e) { console.error("ERRO Autocomplete:", e); }
        } else { console.error("Autocomplete não pôde ser inicializado."); }
    }, 500);

    // --- Listener Botões de Categoria ---
    categoryButtons.forEach(button => {
        button.addEventListener('click', function() {
            const categoryType = this.dataset.category;
            console.log(`>>> CATEGORIA CLICADA: "${categoryType}" <<<`);
            if (!map || !placesService || typeof placesService.nearbySearch !== 'function') {
                alert("Mapa/Places não pronto!"); console.error("Busca categoria: Dependências inválidas."); return;
            }
            console.log(`--- Iniciando busca para "${categoryType}" ---`);
            if(routeFoundBtn) routeFoundBtn.disabled = true; // Desabilita antes
            clearFoundMarkers(); // Limpa anteriores

            let request;
            if (currentUserLocation) {
                console.log("--- Buscando perto (nearbySearch) ---");
                request = { location: currentUserLocation, radius: 5000, keyword: categoryType };
                placesService.nearbySearch(request, handleSearchResults); // Chama o callback REAL
            } else {
                console.log("--- Buscando na área visível (textSearch) ---");
                if (!map.getBounds()) { alert("Área do mapa indefinida."); return; }
                request = { bounds: map.getBounds(), query: categoryType };
                placesService.textSearch(request, handleSearchResults); // Chama o callback REAL
            }
        });
    });

    // --- Listener Botão "Traçar Rota" (AINDA NÃO IMPLEMENTADO COMPLETAMENTE) ---
     if (routeFoundBtn) {
         routeFoundBtn.addEventListener('click', function() {
             alert("Funcionalidade 'Traçar Rota' ainda será reativada.");
             console.log("Botão Traçar Rota clicado (funcionalidade pendente).");
             // A lógica completa de pedir localização, limitar waypoints,
             // chamar directionsService, entrar no modo mapa, etc.,
             // precisa ser REINTRODUZIDA AQUI CUIDADOSAMENTE depois.
         });
     }

     // --- Listeners para Adicionar/Remover Manual (AINDA NÃO IMPLEMENTADOS) ---
     if (addLocationBtn) {
          addLocationBtn.addEventListener('click', () => { alert("Adicionar manual ainda não reativado."); });
     }
      if (selectedLocationsList) {
           selectedLocationsList.addEventListener('click', (event) => {
                if (event.target.classList.contains('remove-btn')) {
                     alert("Remover manual ainda não reativado.");
                }
           });
      }


    // --- Listener Botão Voltar (AINDA NÃO IMPLEMENTADO COMPLETAMENTE) ---
    if (backButton && appContainer) {
        backButton.addEventListener('click', () => {
            alert("Botão Voltar ainda será reativado completamente.");
            console.log("Botão Voltar clicado (funcionalidade pendente).");
            // A lógica de remover classe, limpar rota, redimensionar mapa
            // precisa ser REINTRODUZIDA AQUI CUIDADOSAMENTE depois.
             // appContainer.classList.remove('map-only-mode');
             // ...etc...
        });
    }

    console.log(">>> setupEventListeners: Concluído.");
} // --- FIM DA FUNÇÃO setupEventListeners ---


/**
 * Callback REAL para processar resultados da busca por categoria.
 * Adiciona marcadores simples ao mapa.
 */
function handleSearchResults(results, status) { // Nome REAL da função callback
    console.log(`>>> handleSearchResults: Status: "${status}". Resultados:`, results ? results.length : 0);
    const routeFoundBtn = document.getElementById('route-found-btn');

    clearFoundMarkers(); // Limpa marcadores anteriores ANTES de adicionar novos

    if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
        let bounds = new google.maps.LatLngBounds();
        let validCount = 0;
        results.forEach((place, index) => {
            if (place.name && place.geometry && place.geometry.location) {
                console.log(`   - Adicionando Marcador ${index + 1}: ${place.name}`);
                try {
                     const marker = new google.maps.Marker({ position: place.geometry.location, map: map, title: place.name });
                     foundMarkers.push(marker); // Guarda referência
                     bounds.extend(place.geometry.location);
                     validCount++;
                } catch(e) { console.error(`Erro ao criar marcador para ${place.name}:`, e); }
            } else { console.log(`   - Resultado ${index + 1}: Inválido.`); }
        });

        if (validCount > 0) {
             console.log(`>>> handleSearchResults: ${validCount} marcadores adicionados.`);
             if (currentUserLocation) bounds.extend(currentUserLocation);
             map.fitBounds(bounds); if (map.getZoom() > 16) map.setZoom(16);
             if (routeFoundBtn) routeFoundBtn.disabled = false; console.log(">>> handleSearchResults: Botão Traçar Rota HABILITADO.");
        } else {
             console.warn(">>> handleSearchResults: Status OK, mas nenhum marcador válido."); alert("Nenhum local com localização encontrado.");
             if (routeFoundBtn) routeFoundBtn.disabled = true;
        }
    } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
        console.log(">>> handleSearchResults: ZERO_RESULTS."); alert("Nenhum local encontrado.");
        if (routeFoundBtn) routeFoundBtn.disabled = true;
    } else {
        console.error(`!!! handleSearchResults: Erro na busca! Status: "${status}"`); alert(`Erro ao buscar locais: ${status}.`);
        if (routeFoundBtn) routeFoundBtn.disabled = true;
    }
    console.log(">>> handleSearchResults: FIM.");
}

/**
 * Limpa marcadores da busca por categoria e desabilita botão Traçar Rota.
 */
function clearFoundMarkers() {
    console.log(`>>> clearFoundMarkers: Iniciando. ${foundMarkers ? `Limpando ${foundMarkers.length} marcadores.` : 'Array inválido.'}`);
    const routeFoundBtn = document.getElementById('route-found-btn');

    if (foundMarkers && Array.isArray(foundMarkers) && foundMarkers.length > 0) {
         try {
              foundMarkers.forEach((marker) => { if (marker && typeof marker.setMap === 'function') { marker.setMap(null); } });
              console.log(`>>> clearFoundMarkers: Marcadores removidos do mapa.`);
         } catch (e) { console.error(`>>> clearFoundMarkers: Erro ao remover marcadores:`, e); }
         // Reseta o array para vazio
         foundMarkers = []; // <<<< USA = [] para garantir
         console.log(`>>> clearFoundMarkers: Array 'foundMarkers' resetado para []. Length: ${foundMarkers.length}`);
    } else {
         console.log(">>> clearFoundMarkers: Array já estava vazio ou inválido.");
         foundMarkers = []; // Garante que seja um array vazio
    }
    if (routeFoundBtn) { routeFoundBtn.disabled = true; }
    console.log(">>> clearFoundMarkers: Limpeza concluída.");
}


// Chamada inicial (via callback da API do Google Maps)
console.log("Aguardando API do Google Maps chamar initMap...");