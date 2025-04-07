// ========================================================================
// Rota Fácil - script.js
// VERSÃO DE TESTE SIMPLIFICADA (FOCO NA BUSCA POR CATEGORIA)
// ========================================================================

// Variáveis globais MÍNIMAS
let map;
let placesService;
let currentUserLocation = null; // Guarda a localização obtida

/**
 * Callback principal chamado pela API do Google Maps.
 */
function initMap() {
    console.log(">>> initMap: Iniciando...");

    // Tenta obter localização inicial PRIMEIRO
    if (navigator.geolocation) {
        console.log(">>> initMap: Tentando obter localização inicial...");
        navigator.geolocation.getCurrentPosition(
            (position) => { // SUCESSO ao obter localização
                console.log(">>> initMap: Localização inicial OBTIDA:", position.coords.latitude, position.coords.longitude);
                currentUserLocation = { // Guarda a localização
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                // Só inicializa o mapa DEPOIS de ter a localização
                initializeMapAndServices(currentUserLocation, 15);
            },
            (error) => { // ERRO ao obter localização
                console.warn(">>> initMap: Erro ao obter localização inicial:", error.code, error.message);
                currentUserLocation = null; // Garante que é nulo
                // Inicializa o mapa com localização padrão (SP)
                const defaultCoords = { lat: -23.5505, lng: -46.6333 };
                console.warn(">>> initMap: Usando São Paulo como padrão.");
                initializeMapAndServices(defaultCoords, 13);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 } // Opções mais rápidas
        );
    } else {
        console.warn(">>> initMap: Geolocalização não suportada. Usando São Paulo.");
        currentUserLocation = null;
        const defaultCoords = { lat: -23.5505, lng: -46.6333 };
        initializeMapAndServices(defaultCoords, 13); // Inicializa mapa com SP
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
        placesService = new google.maps.places.PlacesService(map); // Só precisamos deste por enquanto
        console.log(">>> initializeMapAndServices: PlacesService criado.");

        // Configura SOMENTE o listener das categorias
        setupCategoryListeners();

        // Adiciona marcador simples da localização inicial (se obtida)
        if (currentUserLocation) {
             console.log(">>> initializeMapAndServices: Adicionando marcador inicial do usuário.");
             new google.maps.Marker({ position: currentUserLocation, map: map, title: 'Sua Localização Inicial' });
        }

    } catch (error) {
        console.error("!!! ERRO ao inicializar mapa ou PlacesService:", error);
        if (mapDiv) { mapDiv.innerHTML = `<p style="color: red;">ERRO: ${error.message}</p>`; }
    }
}

/**
 * Configura SOMENTE os listeners dos botões de categoria.
 */
function setupCategoryListeners() {
    console.log(">>> setupCategoryListeners: Configurando...");
    const categoryButtons = document.querySelectorAll('.category-btn');

    if (!categoryButtons || categoryButtons.length === 0) {
        console.error("!!! ERRO: Nenhum botão de categoria (.category-btn) encontrado!");
        return;
    }

    categoryButtons.forEach(button => {
        button.addEventListener('click', function() {
            const categoryType = this.dataset.category;
            console.log(`>>> CATEGORIA CLICADA: "${categoryType}" <<<`);

            // Verifica mapa e placesService
            if (!map || !placesService) {
                alert("Mapa ou serviço Places não está pronto!");
                console.error("Busca categoria: Mapa ou PlacesService indisponível.");
                return;
            }

            console.log(`--- Iniciando busca SIMPLIFICADA para "${categoryType}" ---`);
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
 * Callback SIMPLIFICADO para a busca: APENAS LOGA os resultados.
 */
function handleSimplifiedSearchResults(results, status) {
    console.log(`>>> handleSimplifiedSearchResults: Status recebido: "${status}"`);
    if (status === google.maps.places.PlacesServiceStatus.OK) {
        console.log(`>>> handleSimplifiedSearchResults: SUCESSO! ${results ? results.length : 0} resultados encontrados.`);
        // APENAS LOGA OS NOMES (para confirmar que a busca funciona)
        if (results && results.length > 0) {
            results.forEach((place, index) => {
                if (place.name && place.geometry && place.geometry.location) {
                    console.log(`   - Resultado ${index + 1}: ${place.name} (${place.geometry.location.lat()}, ${place.geometry.location.lng()})`);
                } else {
                     console.log(`   - Resultado ${index + 1}: (Nome ou localização inválida)`);
                }
            });
            alert(`Busca por categoria encontrou ${results.length} locais! Verifique o console para a lista.`); // Alerta de sucesso
        } else {
             console.log(">>> handleSimplifiedSearchResults: Status OK, mas array de resultados vazio ou inválido.");
             alert("Busca OK, mas nenhum resultado encontrado.");
        }
    } else {
        console.error(`!!! handleSimplifiedSearchResults: Erro na busca! Status: "${status}"`);
        alert(`Erro ao buscar locais: ${status}. Verifique o console e a chave da API/limites.`); // Alerta de erro
    }
    console.log(">>> handleSimplifiedSearchResults: FIM.");
}

// --- Funções NÃO UTILIZADAS NESTA VERSÃO SIMPLIFICADA ---
// function updateUserMarkerAndAccuracy(...) {} // Comentada ou removida
// function handleLocationError(...) {} // Comentada ou removida
// function startWatchingPosition(...) {} // Comentada ou removida
// function setupEventListeners(...) {} // Substituída por setupCategoryListeners
// function clearFoundMarkers(...) {} // Comentada ou removida
// function addSelectedPlaceToList(...) {} // Comentada ou removida
// ... e os listeners de outros botões ...

// Chamada inicial (via callback da API do Google Maps)
console.log("Aguardando API do Google Maps chamar initMap...");