# Surcos y final de partida

La partida 3D activa `FarmSimulation.enableRows()`. Los tres lotes tienen cinco surcos cada uno (15 en total). La distribución física se conserva al cambiar de modalidad. Llenar un lote exige cinco preparaciones y cinco siembras independientes. El motor sin esta opción conserva el contrato de parcela completa para simulaciones comparativas.

Cada surco conserva preparación, siembra, crecimiento, humedad, fertilidad, salud, plagas y pisoteo. Las acciones del jugador afectan al seleccionado; caminar dentro del lote selecciona el surco cercano. Cosechar exige volver a preparar ese surco. Todos avanzan con cada día, aunque no estén seleccionados. El sensor automático atiende los surcos de precisión que lo necesitan.

Las semillas, el agua y la producción base se distribuyen entre los cinco surcos; la energía de las faenas corresponde al 60% de la acción de un lote completo, redondeada hacia arriba. Las modalidades conservan sus perfiles de trabajo.

El tablero enumera los surcos y destaca el seleccionado. La representación de cultivos usa grupos separados por hilera para mostrar distintas etapas en el mismo lote.

La meta es alcanzar un saldo de inicio + 100.000 COP, después de realizar al menos una cosecha. La victoria se conserva aunque luego se gaste dinero; reiniciar la finca reinicia el objetivo. La pantalla de victoria permite continuar cultivando.
