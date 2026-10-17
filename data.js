// ============================================================================
// TITAN GYM & AI NUTRITION - Base de Datos Inicial (Ejercicios, Rutinas, Alimentos)
// ============================================================================

const DEFAULT_EXERCISES = [
  // PECHO
  { id: 'ex_bench_press', name: 'Press de Banca con Barra', muscle: 'Pecho', equipment: 'Barra', notes: 'Retracción escapular, pies firmes en el suelo, baja la barra al esternón.' },
  { id: 'ex_incline_db_press', name: 'Press Inclinado con Mancuernas', muscle: 'Pecho', equipment: 'Mancuernas', notes: 'Banco a 30-45 grados. Enfoque en haz clavicular (pecho superior).' },
  { id: 'ex_cable_crossover', name: 'Cruces en Polea Alta', muscle: 'Pecho', equipment: 'Polea', notes: 'Mantén una ligera flexión de codos y aprieta el pecho al final.' },
  { id: 'ex_pec_deck', name: 'Aperturas en Máquina (Pec Deck)', muscle: 'Pecho', equipment: 'Máquina', notes: 'Controla la fase excéntrica sin perder tensión.' },
  { id: 'ex_dips_chest', name: 'Fondos en Paralelas (Pecho)', muscle: 'Pecho', equipment: 'Peso Corporal', notes: 'Inclina el torso ligeramente hacia adelante.' },
  { id: 'ex_incline_machine_press', name: 'Press Inclinado en Máquina / Hammer', muscle: 'Pecho', equipment: 'Máquina', notes: 'Excelente estabilidad para llegar cerca del fallo.' },

  // ESPALDA
  { id: 'ex_pull_ups', name: 'Dominadas (Pull-Ups)', muscle: 'Espalda', equipment: 'Peso Corporal', notes: 'Inicia el movimiento deprimiendo las escápulas.' },
  { id: 'ex_lat_pulldown', name: 'Jalón al Pecho en Polea', muscle: 'Espalda', equipment: 'Polea', notes: 'Lleva la barra hacia la parte superior del pecho tirando con los codos.' },
  { id: 'ex_barbell_row', name: 'Remo con Barra (Pendlay / Prono)', muscle: 'Espalda', equipment: 'Barra', notes: 'Torso firme, espalda neutra, tira hacia el abdomen.' },
  { id: 'ex_seated_cable_row', name: 'Remo Sentado en Polea (Agarre Estrecho)', muscle: 'Espalda', equipment: 'Polea', notes: 'Extiende bien los dorsales y retrae al final.' },
  { id: 'ex_db_row', name: 'Remo con Mancuerna a Una Mano', muscle: 'Espalda', equipment: 'Mancuernas', notes: 'Lleva la mancuerna hacia la cadera en forma de arco.' },
  { id: 'ex_straight_arm_pulldown', name: 'Pull-Over en Polea Alta (Brazos Rectos)', muscle: 'Espalda', equipment: 'Polea', notes: 'Aísla los dorsales manteniendo los brazos casi rectos.' },

  // PIERNAS (CUÁDRICEPS / ISQUIOS / GLÚTEOS / PANTORRILLAS)
  { id: 'ex_squat', name: 'Sentadilla Libre con Barra', muscle: 'Piernas', equipment: 'Barra', notes: 'Core firme, rodillas alineadas con la punta de los pies, buena profundidad.' },
  { id: 'ex_hack_squat', name: 'Sentadilla Hack', muscle: 'Piernas', equipment: 'Máquina', notes: 'Espalda bien apoyada, pies en la parte baja para mayor énfasis en cuádriceps.' },
  { id: 'ex_leg_press', name: 'Prensa de Piernas 45°', muscle: 'Piernas', equipment: 'Máquina', notes: 'No bloquees las rodillas por completo arriba; evita despegar el glúteo.' },
  { id: 'ex_rdl', name: 'Peso Muerto Rumano (RDL)', muscle: 'Piernas', equipment: 'Barra', notes: 'Bisagra de cadera, lleva el glúteo hacia atrás sintiendo el estiramiento en isquios.' },
  { id: 'ex_leg_extension', name: 'Extensión de Cuádriceps en Máquina', muscle: 'Piernas', equipment: 'Máquina', notes: 'Pausa de 1 segundo arriba apretando los cuádriceps.' },
  { id: 'ex_leg_curl', name: 'Curl Femoral (Sentado o Tumbado)', muscle: 'Piernas', equipment: 'Máquina', notes: 'Controla toda la bajada sin despegar la cadera.' },
  { id: 'ex_hip_thrust', name: 'Hip Thrust con Barra', muscle: 'Piernas', equipment: 'Barra', notes: 'Mentón recogido, retroversión pélvica arriba y pausa de 1s.' },
  { id: 'ex_bulgarian_split_squat', name: 'Sentadilla Búlgara con Mancuernas', muscle: 'Piernas', equipment: 'Mancuernas', notes: 'Torso recto para cuádriceps o ligeramente inclinado para glúteo.' },
  { id: 'ex_calf_raise', name: 'Elevación de Talones (Gemelos)', muscle: 'Piernas', equipment: 'Máquina', notes: 'Pausa abajo en estiramiento y sube completo.' },

  // HOMBROS
  { id: 'ex_ohp', name: 'Press Militar con Barra', muscle: 'Hombros', equipment: 'Barra', notes: 'Glúteos y abdomen apretados, sube la barra en línea vertical.' },
  { id: 'ex_db_shoulder_press', name: 'Press de Hombros con Mancuernas', muscle: 'Hombros', equipment: 'Mancuernas', notes: 'Baja hasta la altura de las orejas con codos a ~45-60° del torso.' },
  { id: 'ex_lateral_raises', name: 'Elevaciones Laterales con Mancuernas', muscle: 'Hombros', equipment: 'Mancuernas', notes: 'Guía con los codos ligeramente hacia adelante en el plano escapular.' },
  { id: 'ex_cable_lateral_raise', name: 'Elevaciones Laterales en Polea', muscle: 'Hombros', equipment: 'Polea', notes: 'Tensión constante desde la parte más baja del recorrido.' },
  { id: 'ex_face_pull', name: 'Face Pull en Polea con Cuerda', muscle: 'Hombros', equipment: 'Polea', notes: 'Enfoque en deltoides posterior y rotadores externos.' },
  { id: 'ex_rear_delt_fly', name: 'Pájaros / Deltoides Posterior en Máquina', muscle: 'Hombros', equipment: 'Máquina', notes: 'Empuja hacia afuera sin juntar en exceso las escápulas.' },

  // BÍCEPS
  { id: 'ex_barbell_curl', name: 'Curl de Bíceps con Barra Z o Recta', muscle: 'Bíceps', equipment: 'Barra', notes: 'Codos pegados al torso, evita balancear la espalda.' },
  { id: 'ex_incline_db_curl', name: 'Curl de Bíceps en Banco Inclinado', muscle: 'Bíceps', equipment: 'Mancuernas', notes: 'Máximo estiramiento de la cabeza larga del bíceps.' },
  { id: 'ex_hammer_curl', name: 'Curl Martillo con Mancuernas', muscle: 'Bíceps', equipment: 'Mancuernas', notes: 'Trabaja braquial y braquiorradial.' },
  { id: 'ex_preacher_curl', name: 'Curl Predicador (Banco Scott)', muscle: 'Bíceps', equipment: 'Máquina', notes: 'Aislamiento estricto sin impulso.' },

  // TRÍCEPS
  { id: 'ex_tricep_pushdown', name: 'Extensión de Tríceps en Polea con Cuerda', muscle: 'Tríceps', equipment: 'Polea', notes: 'Abre la cuerda al final manteniendo los codos fijos.' },
  { id: 'ex_overhead_tricep_ext', name: 'Extensión de Tríceps Trasnuca en Polea', muscle: 'Tríceps', equipment: 'Polea', notes: 'Énfasis en la cabeza larga del tríceps en estiramiento.' },
  { id: 'ex_skullcrushers', name: 'Press Francés con Barra Z', muscle: 'Tríceps', equipment: 'Barra', notes: 'Baja la barra hacia la frente o detrás de la cabeza.' },
  { id: 'ex_dips_triceps', name: 'Fondos en Paralelas (Tríceps)', muscle: 'Tríceps', equipment: 'Peso Corporal', notes: 'Torso vertical y codos cerca del cuerpo.' },

  // CORE & CARDIO
  { id: 'ex_cable_crunch', name: 'Crunch Abdominal en Polea Alta', muscle: 'Core', equipment: 'Polea', notes: 'Flexiona la columna vertebral, no la cadera.' },
  { id: 'ex_hanging_leg_raise', name: 'Elevación de Piernas Colgado', muscle: 'Core', equipment: 'Peso Corporal', notes: 'Sube la pelvis hacia el pecho evitando el balanceo.' },
  { id: 'ex_plank', name: 'Plancha Abdominal', muscle: 'Core', equipment: 'Peso Corporal', notes: 'Abdomen y glúteos contraídos.' }
];

const DEFAULT_ROUTINES = [
  {
    id: 'rt_push',
    name: 'Día 1: Push (Pecho, Hombros y Tríceps)',
    tag: 'PPL • Fuerza e Hipertrofia',
    color: '#10b981',
    exercises: [
      { exerciseId: 'ex_bench_press', targetSets: 4, targetReps: '6-8', restSeconds: 150 },
      { exerciseId: 'ex_incline_db_press', targetSets: 3, targetReps: '8-10', restSeconds: 120 },
      { id_ref: 'ex_db_shoulder_press', exerciseId: 'ex_db_shoulder_press', targetSets: 3, targetReps: '8-10', restSeconds: 120 },
      { exerciseId: 'ex_lateral_raises', targetSets: 4, targetReps: '12-15', restSeconds: 75 },
      { exerciseId: 'ex_tricep_pushdown', targetSets: 3, targetReps: '10-12', restSeconds: 90 },
      { exerciseId: 'ex_overhead_tricep_ext', targetSets: 3, targetReps: '10-12', restSeconds: 90 }
    ]
  },
  {
    id: 'rt_pull',
    name: 'Día 2: Pull (Espalda, Deltoides Post. y Bíceps)',
    tag: 'PPL • Tracción',
    color: '#3b82f6',
    exercises: [
      { exerciseId: 'ex_lat_pulldown', targetSets: 4, targetReps: '8-10', restSeconds: 120 },
      { exerciseId: 'ex_barbell_row', targetSets: 4, targetReps: '6-8', restSeconds: 150 },
      { exerciseId: 'ex_seated_cable_row', targetSets: 3, targetReps: '10-12', restSeconds: 90 },
      { exerciseId: 'ex_face_pull', targetSets: 3, targetReps: '12-15', restSeconds: 75 },
      { exerciseId: 'ex_barbell_curl', targetSets: 3, targetReps: '8-10', restSeconds: 90 },
      { exerciseId: 'ex_incline_db_curl', targetSets: 3, targetReps: '10-12', restSeconds: 75 }
    ]
  },
  {
    id: 'rt_legs',
    name: 'Día 3: Legs (Pierna Completa y Core)',
    tag: 'PPL • Tren Inferior',
    color: '#f59e0b',
    exercises: [
      { exerciseId: 'ex_squat', targetSets: 4, targetReps: '6-8', restSeconds: 180 },
      { exerciseId: 'ex_rdl', targetSets: 4, targetReps: '8-10', restSeconds: 150 },
      { exerciseId: 'ex_leg_press', targetSets: 3, targetReps: '10-12', restSeconds: 120 },
      { exerciseId: 'ex_leg_extension', targetSets: 3, targetReps: '12-15', restSeconds: 90 },
      { exerciseId: 'ex_leg_curl', targetSets: 3, targetReps: '12-15', restSeconds: 90 },
      { exerciseId: 'ex_calf_raise', targetSets: 4, targetReps: '12-15', restSeconds: 60 }
    ]
  },
  {
    id: 'rt_upper',
    name: 'Torso Completo (Upper Body)',
    tag: 'Torso / Pierna',
    color: '#8b5cf6',
    exercises: [
      { exerciseId: 'ex_incline_db_press', targetSets: 3, targetReps: '8-10', restSeconds: 120 },
      { exerciseId: 'ex_pull_ups', targetSets: 3, targetReps: '6-10', restSeconds: 120 },
      { exerciseId: 'ex_pec_deck', targetSets: 3, targetReps: '12-15', restSeconds: 90 },
      { exerciseId: 'ex_db_row', targetSets: 3, targetReps: '10-12', restSeconds: 90 },
      { exerciseId: 'ex_cable_lateral_raise', targetSets: 4, targetReps: '12-15', restSeconds: 75 },
      { exerciseId: 'ex_hammer_curl', targetSets: 3, targetReps: '10-12', restSeconds: 75 },
      { exerciseId: 'ex_skullcrushers', targetSets: 3, targetReps: '10-12', restSeconds: 75 }
    ]
  }
];

// Base de datos local de alimentos comunes (valores por cada 100g o porción indicada)
const DEFAULT_FOODS = [
  // Proteínas
  { id: 'fd_chicken_breast', name: 'Pechuga de Pollo (Cocida)', brand: 'Natural', servingG: 100, kcal: 165, protein: 31, carbs: 0, fat: 3.6, barcode: '100001' },
  { id: 'fd_chicken_raw', name: 'Pechuga de Pollo (Cruda)', brand: 'Natural', servingG: 100, kcal: 120, protein: 22.5, carbs: 0, fat: 2.6, barcode: '100002' },
  { id: 'fd_beef_lean', name: 'Carne de Res Magra (Cocida)', brand: 'Natural', servingG: 100, kcal: 215, protein: 28, carbs: 0, fat: 11, barcode: '100003' },
  { id: 'fd_egg_whole', name: 'Huevo Entero Grande (1 unidad ~60g)', brand: 'Natural', servingG: 60, kcal: 86, protein: 7.5, carbs: 0.6, fat: 6, barcode: '100004' },
  { id: 'fd_egg_whites', name: 'Claras de Huevo', brand: 'Natural', servingG: 100, kcal: 52, protein: 11, carbs: 0.7, fat: 0.2, barcode: '100005' },
  { id: 'fd_tuna_water', name: 'Atún en Agua (Escurrido)', brand: 'Lata', servingG: 120, kcal: 130, protein: 29, carbs: 0, fat: 1.2, barcode: '7501045403014' },
  { id: 'fd_salmon', name: 'Salmón a la Plancha', brand: 'Natural', servingG: 100, kcal: 208, protein: 20, carbs: 0, fat: 13, barcode: '100007' },
  { id: 'fd_whey_scoop', name: 'Proteína Whey Isolate/Concentrate (1 Scoop)', brand: 'Suplemento', servingG: 30, kcal: 120, protein: 24, carbs: 3, fat: 1.5, barcode: '748927024081' },
  { id: 'fd_greek_yogurt', name: 'Yogurt Griego Sin Azúcar', brand: 'Lácteo', servingG: 150, kcal: 90, protein: 15, carbs: 5.5, fat: 0.5, barcode: '100009' },
  { id: 'fd_cottage_cheese', name: 'Queso Cottage / Requesón Bajo en Grasa', brand: 'Lácteo', servingG: 100, kcal: 85, protein: 12, carbs: 3.5, fat: 2.5, barcode: '100010' },
  { id: 'fd_milk_whole', name: 'Leche Entera (1 vaso 250ml)', brand: 'Lácteo', servingG: 250, kcal: 150, protein: 8, carbs: 12, fat: 8, barcode: '100011' },
  { id: 'fd_milk_skim', name: 'Leche Deslactosada / Light (250ml)', brand: 'Lácteo', servingG: 250, kcal: 105, protein: 8, carbs: 12, fat: 2.5, barcode: '100012' },

  // Carbohidratos
  { id: 'fd_white_rice', name: 'Arroz Blanco (Cocido)', brand: 'Natural', servingG: 100, kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, barcode: '100013' },
  { id: 'fd_brown_rice', name: 'Arroz Integral (Cocido)', brand: 'Natural', servingG: 100, kcal: 112, protein: 2.6, carbs: 23.5, fat: 0.9, barcode: '100014' },
  { id: 'fd_oats', name: 'Avena en Hojuelas (Cruda)', brand: 'Cereal', servingG: 50, kcal: 190, protein: 6.5, carbs: 34, fat: 3.3, barcode: '100015' },
  { id: 'fd_potato', name: 'Papa / Patata Cocida o al Horno', brand: 'Natural', servingG: 150, kcal: 130, protein: 3, carbs: 30, fat: 0.2, barcode: '100016' },
  { id: 'fd_sweet_potato', name: 'Camote / Batata / Boniato Cocido', brand: 'Natural', servingG: 150, kcal: 135, protein: 2.5, carbs: 31, fat: 0.2, barcode: '100017' },
  { id: 'fd_pasta_cooked', name: 'Pasta / Espagueti (Cocido)', brand: 'Trigo', servingG: 100, kcal: 158, protein: 5.8, carbs: 31, fat: 0.9, barcode: '100018' },
  { id: 'fd_whole_bread', name: 'Pan Integral de Molde (2 rebanadas)', brand: 'Panadería', servingG: 60, kcal: 150, protein: 6, carbs: 26, fat: 2, barcode: '100019' },
  { id: 'fd_corn_tortilla', name: 'Tortilla de Maíz (2 unidades)', brand: 'Tradicional', servingG: 60, kcal: 130, protein: 3.4, carbs: 27, fat: 1.5, barcode: '100020' },
  { id: 'fd_beans_cooked', name: 'Frijoles / Lentejas Cocidas', brand: 'Legumbre', servingG: 100, kcal: 120, protein: 8.5, carbs: 21, fat: 0.5, barcode: '100021' },
  { id: 'fd_arepa', name: 'Arepa de Maíz Asada (Mediana)', brand: 'Tradicional', servingG: 100, kcal: 195, protein: 4.5, carbs: 41, fat: 1.2, barcode: '100022' },

  // Frutas y Verduras
  { id: 'fd_banana', name: 'Plátano / Banano (1 mediano ~120g)', brand: 'Fruta', servingG: 120, kcal: 105, protein: 1.3, carbs: 27, fat: 0.4, barcode: '100023' },
  { id: 'fd_apple', name: 'Manzana (1 mediana ~150g)', brand: 'Fruta', servingG: 150, kcal: 78, protein: 0.4, carbs: 21, fat: 0.3, barcode: '100024' },
  { id: 'fd_strawberries', name: 'Fresas / Frutillas', brand: 'Fruta', servingG: 100, kcal: 32, protein: 0.7, carbs: 7.7, fat: 0.3, barcode: '100025' },
  { id: 'fd_broccoli', name: 'Brócoli y Vegetales Verdes al Vapor', brand: 'Verdura', servingG: 100, kcal: 35, protein: 2.4, carbs: 7, fat: 0.4, barcode: '100026' },
  { id: 'fd_mixed_salad', name: 'Ensalada Mixta (Lechuga, Tomate, Pepino)', brand: 'Verdura', servingG: 150, kcal: 30, protein: 1.5, carbs: 6, fat: 0.3, barcode: '100027' },

  // Grasas Saludables y Otros
  { id: 'fd_avocado', name: 'Aguacate / Palta', brand: 'Natural', servingG: 100, kcal: 160, protein: 2, carbs: 8.5, fat: 14.7, barcode: '100028' },
  { id: 'fd_peanut_butter', name: 'Crema de Maní / Cacahuate Natural (1 cda)', brand: 'Natural', servingG: 16, kcal: 95, protein: 4, carbs: 3, fat: 8, barcode: '100029' },
  { id: 'fd_olive_oil', name: 'Aceite de Oliva Extra Virgen (1 cda 10g)', brand: 'Natural', servingG: 10, kcal: 88, protein: 0, carbs: 0, fat: 10, barcode: '100030' },
  { id: 'fd_almonds', name: 'Almendras o Nueces (1 puñado 30g)', brand: 'Fruto Seco', servingG: 30, kcal: 175, protein: 6, carbs: 6, fat: 15, barcode: '100031' },

  // Comidas Rápidas / Platos Comunes
  { id: 'fd_chicken_rice_bowl', name: 'Plato Fitness: Pollo + Arroz + Ensalada', brand: 'Casero', servingG: 400, kcal: 520, protein: 45, carbs: 62, fat: 9, barcode: '100032' },
  { id: 'fd_protein_shake_banana', name: 'Batido Proteico con Leche, Avena y Plátano', brand: 'Casero', servingG: 450, kcal: 480, protein: 38, carbs: 64, fat: 7.5, barcode: '100033' },
  { id: 'fd_burger', name: 'Hamburguesa de Res con Queso', brand: 'Restaurante', servingG: 220, kcal: 560, protein: 30, carbs: 42, fat: 29, barcode: '100034' },
  { id: 'fd_pizza_slice', name: 'Pizza de Queso/Pepperoni (1 porción)', brand: 'Restaurante', servingG: 110, kcal: 285, protein: 12, carbs: 36, fat: 10, barcode: '100035' }
];
