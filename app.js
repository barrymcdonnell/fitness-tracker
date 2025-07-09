// app.js

// --- IndexedDB Setup ---
const DB_NAME = 'FitnessTrackerDB';
const DB_VERSION = 1;
let db;

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = event => {
            console.error('IndexedDB error:', event.target.errorCode);
            reject('Database error');
        };

        request.onsuccess = event => {
            db = event.target.result;
            console.log('IndexedDB opened successfully');
            resolve(db);
        };

        request.onupgradeneeded = event => {
            const db = event.target.result;
            // Create object stores (tables) if they don't exist
            db.createObjectStore('dailyData', { keyPath: 'date' }); // Stores steps, water, calories, macros
            db.createObjectStore('weights', { keyPath: 'date' }); // Stores weekly weight
            // No need for 'workouts' store yet, as the plan is static, but useful for custom workouts later
            console.log('IndexedDB upgrade needed, stores created');
        };
    });
}

// --- Data Persistence Functions ---

async function saveDailyData(date, data) {
    if (!db) await openDatabase();
    const transaction = db.transaction(['dailyData'], 'readwrite');
    const store = transaction.objectStore('dailyData');
    return new Promise((resolve, reject) => {
        const request = store.put({ date, ...data });
        request.onsuccess = () => resolve();
        request.onerror = () => reject('Error saving daily data');
    });
}

async function getDailyData(date) {
    if (!db) await openDatabase();
    const transaction = db.transaction(['dailyData'], 'readonly');
    const store = transaction.objectStore('dailyData');
    return new Promise((resolve, reject) => {
        const request = store.get(date);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject('Error getting daily data');
    });
}

async function saveWeight(date, weight) {
    if (!db) await openDatabase();
    const transaction = db.transaction(['weights'], 'readwrite');
    const store = transaction.objectStore('weights');
    return new Promise((resolve, reject) => {
        const request = store.put({ date, weight });
        request.onsuccess = () => resolve();
        request.onerror = () => reject('Error saving weight');
    });
}

async function getAllWeights() {
    if (!db) await openDatabase();
    const transaction = db.transaction(['weights'], 'readonly');
    const store = transaction.objectStore('weights');
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject('Error getting all weights');
    });
}

// --- UI / Tab Navigation ---

document.addEventListener('DOMContentLoaded', async () => {
    await openDatabase(); // Open DB on app load

    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');

    function showTab(tabId) {
        tabContents.forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabId).classList.add('active');

        navItems.forEach(item => {
            if (item.dataset.tab === tabId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
        // Update URL hash for direct linking/bookmarking
        window.location.hash = tabId;
        renderContent(tabId); // Render content for the active tab
    }

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = item.dataset.tab;
            showTab(tabId);
        });
    });

    // Handle initial load based on URL hash
    const initialTab = window.location.hash ? window.location.hash.substring(1) : 'dashboard';
    showTab(initialTab);


    // --- Dashboard Logic ---
    const saveDailyDataBtn = document.getElementById('saveDailyData');
    saveDailyDataBtn.addEventListener('click', async () => {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const steps = parseInt(document.getElementById('stepsInput').value) || 0;
        const water = parseFloat(document.getElementById('waterInput').value) || 0;
        const calories = parseInt(document.getElementById('calorieInput').value) || 0;
        const protein = parseInt(document.getElementById('proteinInput').value) || 0;
        const carbs = parseInt(document.getElementById('carbInput').value) || 0;
        const fat = parseInt(document.getElementById('fatInput').value) || 0;

        try {
            await saveDailyData(today, { steps, water, calories, protein, carbs, fat });
            alert('Daily data saved!');
            renderDashboardData(today); // Refresh dashboard display
        } catch (error) {
            alert('Error saving daily data: ' + error);
        }
    });

    // --- Trackers Logic ---
    const saveWeightBtn = document.getElementById('saveWeight');
    saveWeightBtn.addEventListener('click', async () => {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const weight = parseFloat(document.getElementById('weightInput').value);
        if (weight > 0) {
            try {
                await saveWeight(today, weight);
                alert('Weight saved!');
                renderWeightHistory();
            } catch (error) {
                alert('Error saving weight: ' + error);
            }
        } else {
            alert('Please enter a valid weight.');
        }
    });

    const saveMacrosBtn = document.getElementById('saveMacros');
    saveMacrosBtn.addEventListener('click', async () => {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const calories = parseInt(document.getElementById('calorieInput').value) || 0;
        const protein = parseInt(document.getElementById('proteinInput').value) || 0;
        const carbs = parseInt(document.getElementById('carbInput').value) || 0;
        const fat = parseInt(document.getElementById('fatInput').value) || 0;

        if (calories || protein || carbs || fat) {
             try {
                // Get existing daily data to merge
                const existingData = await getDailyData(today) || {};
                await saveDailyData(today, { ...existingData, calories, protein, carbs, fat });
                alert('Macros saved!');
                renderDashboardData(today); // Refresh dashboard display
            } catch (error) {
                alert('Error saving macros: ' + error);
            }
        } else {
            alert('Please enter at least one macro value.');
        }
    });


    // --- Rendering Functions (called when tabs are activated) ---

    async function renderContent(tabId) {
        const today = new Date().toISOString().split('T')[0];
        switch (tabId) {
            case 'dashboard':
                renderDashboardData(today);
                renderTodayWorkout();
                break;
            case 'schedule':
                renderWeeklySchedule();
                break;
            case 'trackers':
                renderWeightHistory();
                // We'll leave macro inputs as direct entry in the tracker tab,
                // but daily macro summary will be on dashboard
                break;
            case 'recipes':
                renderRecipes();
                break;
        }
    }

    async function renderDashboardData(date) {
        const data = await getDailyData(date);
        document.getElementById('displaySteps').textContent = data ? data.steps || 0 : 0;
        document.getElementById('displayWater').textContent = data ? `${data.water || 0} L` : '0 L';
        document.getElementById('displayCalories').textContent = data ? data.calories || 0 : 0;
        document.getElementById('displayProtein').textContent = data ? `${data.protein || 0}g` : '0g';
        document.getElementById('displayCarbs').textContent = data ? `${data.carbs || 0}g` : '0g';
        document.getElementById('displayFat').textContent = data ? `${data.fat || 0}g` : '0g';

        // Pre-fill daily inputs if data exists for today
        if (data) {
            document.getElementById('stepsInput').value = data.steps || '';
            document.getElementById('waterInput').value = data.water || '';
            document.getElementById('calorieInput').value = data.calories || '';
            document.getElementById('proteinInput').value = data.protein || '';
            document.getElementById('carbInput').value = data.carbs || '';
            document.getElementById('fatInput').value = data.fat || '';
        } else {
            document.getElementById('stepsInput').value = '';
            document.getElementById('waterInput').value = '';
            document.getElementById('calorieInput').value = '';
            document.getElementById('proteinInput').value = '';
            document.getElementById('carbInput').value = '';
            document.getElementById('fatInput').value = '';
        }
    }

    async function renderWeightHistory() {
        const weights = await getAllWeights();
        const weightHistoryDiv = document.getElementById('weightHistory');
        weightHistoryDiv.innerHTML = '<h4>Weight Log:</h4>';
        if (weights.length === 0) {
            weightHistoryDiv.innerHTML += '<p>No weight data yet.</p>';
            return;
        }
        const ul = document.createElement('ul');
        weights.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(entry => {
            const li = document.createElement('li');
            li.textContent = `${entry.date}: ${entry.weight} kg`;
            ul.appendChild(li);
        });
        weightHistoryDiv.appendChild(ul);
        // Implement simple chart here if desired (e.g., using a small library or just text)
    }

    function renderRecipes() {
        const recipeListDiv = document.getElementById('recipeList');
        recipeListDiv.innerHTML = ''; // Clear previous content

        RECIPES.forEach(recipe => {
            const card = document.createElement('div');
            card.className = 'recipe-card';
            card.innerHTML = `
                <h3>${recipe.name}</h3>
                <p><strong>Macros (per serving):</strong> Protein: ${recipe.protein}g, Carbs: ${recipe.carbs}g, Fat: ${recipe.fat}g, Calories: ${recipe.calories}</p>
                <p><strong>Servings:</strong> ${recipe.servings}</p>
                <h4>Ingredients:</h4>
                <ul>${recipe.ingredients.map(ing => `<li>${ing}</li>`).join('')}</ul>
                <h4>Instructions:</h4>
                <p>${recipe.instructions}</p>
            `;
            recipeListDiv.appendChild(card);
        });
    }

    // --- Workout Plan Integration (from 6-month plan below) ---
    // This will require a mapping of current date to week/day of the plan.
    // For simplicity, let's assume we start Week 1 Day 1 today or a specific start date.

    // Helper to get week number from a start date (e.g., first Monday after app start)
    function getWeekAndDay(startDateStr) {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to start of day
        const startDate = new Date(startDateStr);
        startDate.setHours(0, 0, 0, 0);

        if (today < startDate) {
            return { week: 0, day: 0, message: "Program hasn't started yet!" };
        }

        const diffTime = Math.abs(today - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        const week = Math.floor(diffDays / 7) + 1; // +1 because week 0 is not a thing
        const day = (diffDays % 7) + 1;

        return { week, day };
    }

    // You would set your program start date here
    const PROGRAM_START_DATE = '2025-07-07'; // Example: Start on Monday, July 7th, 2025

    function renderTodayWorkout() {
        const todayWorkoutSummary = document.getElementById('todayWorkoutSummary');
        const { week, day } = getWeekAndDay(PROGRAM_START_DATE);

        if (week > 26 || week === 0) { // Assuming 26 weeks for 6 months
            todayWorkoutSummary.innerHTML = `<p>Workout program completed or not started yet. Week ${week}, Day ${day}.</p>`;
            return;
        }

        const currentWeekPlan = WORKOUT_PLAN[`Week ${week}`];
        if (currentWeekPlan) {
            const workoutForToday = currentWeekPlan[`Day ${day}`];
            if (workoutForToday) {
                let workoutHtml = `<h3>Today's Workout (Week ${week}, Day ${day})</h3>`;
                workoutHtml += `<h4>${workoutForToday.type}</h4>`;
                workoutHtml += `<p>${workoutForToday.description}</p>`;
                if (workoutForToday.exercises && workoutForToday.exercises.length > 0) {
                    workoutHtml += '<h4>Exercises:</h4><ul>';
                    workoutForToday.exercises.forEach(ex => {
                        workoutHtml += `<li><strong>${ex.name}</strong>: ${ex.sets} sets x ${ex.reps} reps (${ex.notes || ''})</li>`;
                    });
                    workoutHtml += '</ul>';
                }
                todayWorkoutSummary.innerHTML = workoutHtml;
            } else {
                todayWorkoutSummary.innerHTML = `<p>No specific workout planned for Week ${week}, Day ${day}. Likely a rest day or active recovery.</p>`;
            }
        } else {
             todayWorkoutSummary.innerHTML = `<p>No workout data found for Week ${week}.</p>`;
        }
    }

    function renderWeeklySchedule() {
        const weeklyScheduleDisplay = document.getElementById('weeklyScheduleDisplay');
        weeklyScheduleDisplay.innerHTML = ''; // Clear previous content

        const { week: currentWeekNum, day: currentDayNum } = getWeekAndDay(PROGRAM_START_DATE);

        if (currentWeekNum > 26 || currentWeekNum === 0) {
            weeklyScheduleDisplay.innerHTML = `<p>Workout program completed or not started yet.</p>`;
            return;
        }

        const currentWeekPlan = WORKOUT_PLAN[`Week ${currentWeekNum}`];
        if (!currentWeekPlan) {
            weeklyScheduleDisplay.innerHTML = `<p>No plan found for the current week.</p>`;
            return;
        }

        // Days of the week for display
        const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

        for (let i = 1; i <= 7; i++) {
            const dayKey = `Day ${i}`;
            const workout = currentWeekPlan[dayKey];
            const dayDiv = document.createElement('div');
            const date = new Date(PROGRAM_START_DATE);
            date.setDate(date.getDate() + (currentWeekNum - 1) * 7 + (i - 1));
            const dateString = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

            dayDiv.innerHTML = `<strong>${daysOfWeek[i - 1]} (${dateString}):</strong> ${workout ? workout.type : 'Rest/Active Recovery'}`;
            if (i === currentDayNum) {
                dayDiv.classList.add('current-day');
            }
            // Add a click listener to show details (could expand the workout details or go to dashboard)
            dayDiv.addEventListener('click', () => {
                alert(`Workout for ${daysOfWeek[i - 1]}:\n${workout ? workout.description + '\n\n' + workout.exercises.map(e => `${e.name}: ${e.sets}x${e.reps}`).join('\n') : 'Rest or active recovery.'}`);
            });
            weeklyScheduleDisplay.appendChild(dayDiv);
        }
    }

    // Initial renders when app loads
    renderDashboardData(new Date().toISOString().split('T')[0]);
    renderTodayWorkout(); // Show today's workout on load
});

// --- Dummy Data (Replace with real data or load dynamically) ---

const RECIPES = [
    {
        name: "Quick Chicken & Veggie Stir-fry",
        protein: 40, carbs: 30, fat: 15, calories: 435,
        servings:1,
        ingredients: [
            "150g chicken breast, sliced",
            "1 tbsp soy sauce",
            "1 tsp sesame oil",
            "Mixed vegetables (broccoli, bell peppers, carrots)",
            "1/2 onion, sliced",
            "1 clove garlic, minced",
            "1/2 cup cooked brown rice (optional)"
        ],
        instructions: "Marinate chicken in soy sauce and sesame oil. Heat a wok/pan, stir-fry chicken until cooked. Add vegetables and garlic, stir-fry until tender-crisp. Serve with brown rice."
    },
    {
        name: "Cottage Cheese & Berries Bowl",
        protein: 25, carbs: 20, fat: 5, calories: 225,
        servings:1,
        ingredients: [
            "200g low-fat cottage cheese",
            "1/2 cup mixed berries",
            "1 tbsp chopped nuts (almonds/walnuts)",
            "Drizzle of honey (optional)"
        ],
        instructions: "Combine cottage cheese and berries in a bowl. Top with chopped nuts and a drizzle of honey if desired. Enjoy as a quick breakfast or snack."
    },
    {
        name: "Lentil Soup (Vegetarian Protein)",
        protein: 18, carbs: 45, fat: 8, calories: 350,
        servings:1,
        ingredients: [
            "1 cup red lentils, rinsed",
            "4 cups vegetable broth",
            "1 carrot, diced",
            "1 celery stalk, diced",
            "1 onion, diced",
            "1 can (400g) diced tomatoes",
            "Spices: cumin, turmeric, salt, pepper"
        ],
        instructions: "Sauté onion, carrot, celery. Add lentils, broth, diced tomatoes, and spices. Bring to a boil, then simmer for 20-25 minutes until lentils are tender. Serve hot."
    }
];

// --- 6-Month Comprehensive Workout Plan Data ---
// This is a large object. Consider moving it to a separate `workout-plan.js` for better organization
// and import it if your project grows larger with a build step (like Webpack/Vite).
// For now, it's defined here for simplicity.

const WORKOUT_PLAN = {
    // --- MONTH 1: Foundation & Strength Building ---
    "Week 1": {
        "Day 1": {
            type: "Full Body Strength A",
            description: "Focus on compound movements to build a solid foundation.",
            exercises: [
                { name: "Goblet Squats (Kettlebell/Dumbbell)", sets: 3, reps: 10, notes: "Focus on depth." },
                { name: "Dumbbell Rows (Bent-Over)", sets: 3, reps: 10, notes: "Squeeze shoulder blades." },
                { name: "Dumbbell Floor Press", sets: 3, reps: 10, notes: "Control the eccentric." },
                { name: "Plank", sets: 3, reps: "30-45 sec", notes: "Keep core tight." },
                { name: "Skipping Rope", sets: 1, reps: "10 min", notes: "Light cardio warm-up." }
            ]
        },
        "Day 2": {
            type: "Active Recovery / Light Cardio",
            description: "Focus on blood flow and light movement.",
            exercises: [
                { name: "Skipping Rope", sets: 1, reps: "20 min", notes: "Steady pace." },
                { name: "Dynamic Stretches", sets: 1, reps: "10 min", notes: "Leg swings, arm circles." }
            ]
        },
        "Day 3": {
            type: "Full Body Strength B",
            description: "Another full body session, varying exercises.",
            exercises: [
                { name: "Romanian Deadlifts (Dumbbell/Kettlebell)", sets: 3, reps: 10, notes: "Feel stretch in hamstrings." },
                { name: "Dumbbell Overhead Press (Standing)", sets: 3, reps: 10, notes: "Core braced." },
                { name: "Dumbbell Lunges (Alternating)", sets: 3, reps: "8-10 per leg", notes: "Stable and controlled." },
                { name: "Resistance Band Glute Bridge", sets: 3, reps: 15, notes: "Band above knees." },
                { name: "Skipping Rope", sets: 1, reps: "10 min", notes: "Light cardio warm-up." }
            ]
        },
        "Day 4": { type: "Rest", description: "Complete rest." },
        "Day 5": {
            type: "Full Body Strength A",
            description: "Repeat of Day 1, aim for slight increase in reps or weight.",
            exercises: [
                { name: "Goblet Squats (Kettlebell/Dumbbell)", sets: 3, reps: 10, notes: "Focus on depth." },
                { name: "Dumbbell Rows (Bent-Over)", sets: 3, reps: 10, notes: "Squeeze shoulder blades." },
                { name: "Dumbbell Floor Press", sets: 3, reps: 10, notes: "Control the eccentric." },
                { name: "Plank", sets: 3, reps: "30-45 sec", notes: "Keep core tight." },
                { name: "Skipping Rope", sets: 1, reps: "10 min", notes: "Light cardio warm-up." }
            ]
        },
        "Day 6": {
            type: "Active Recovery / Light Cardio",
            description: "Focus on blood flow and light movement.",
            exercises: [
                { name: "Skipping Rope", sets: 1, reps: "20 min", notes: "Steady pace." },
                { name: "Static Stretches (Yoga Blocks optional)", sets: 1, reps: "10 min", notes: "Hold each stretch 20-30 seconds." }
            ]
        },
        "Day 7": { type: "Rest", description: "Complete rest." }
    },
    "Week 2": {
        "Day 1": {
            type: "Full Body Strength A",
            description: "Increase reps or weight from last week.",
            exercises: [
                { name: "Goblet Squats (Kettlebell/Dumbbell)", sets: 3, reps: 12, notes: "Increase reps or weight." },
                { name: "Dumbbell Rows (Bent-Over)", sets: 3, reps: 12, notes: "Increase reps or weight." },
                { name: "Dumbbell Floor Press", sets: 3, reps: 12, notes: "Increase reps or weight." },
                { name: "Side Plank", sets: 3, reps: "30 sec/side", notes: "Engage obliques." },
                { name: "Skipping Rope (Warm-up)", sets: 1, reps: "10 min", notes: "Warm-up." }
            ]
        },
        "Day 2": {
            type: "HIIT Cardio",
            description: "Short, intense cardio bursts.",
            exercises: [
                { name: "Skipping Rope HIIT", sets: "5 rounds", reps: "30s fast / 30s rest", notes: "High intensity." },
                { name: "Mountain Climbers", sets: 3, reps: "45 sec", notes: "Fast pace." }
            ]
        },
        "Day 3": {
            type: "Full Body Strength B",
            description: "Increase reps or weight from last week.",
            exercises: [
                { name: "Romanian Deadlifts (Dumbbell/Kettlebell)", sets: 3, reps: 12, notes: "Increase reps or weight." },
                { name: "Dumbbell Overhead Press (Standing)", sets: 3, reps: 12, notes: "Increase reps or weight." },
                { name: "Dumbbell Lunges (Alternating)", sets: 3, reps: "10-12 per leg", notes: "Increase reps or weight." },
                { name: "Resistance Band Glute Bridge", sets: 3, reps: 18, notes: "Increase reps." },
                { name: "Skipping Rope (Warm-up)", sets: 1, reps: "10 min", notes: "Warm-up." }
            ]
        },
        "Day 4": { type: "Rest", description: "Complete rest." },
        "Day 5": {
            type: "Full Body Strength C (Circuit)",
            description: "A circuit-style workout for conditioning.",
            exercises: [
                { name: "Dumbbell Thrusters", sets: 3, reps: 12, notes: "Combine squat and overhead press." },
                { name: "Push-ups (on knees/toes/yoga blocks)", sets: 3, reps: "AMRAP", notes: "As many reps as possible with good form." },
                { name: "Kettlebell Swings", sets: 3, reps: 15, notes: "Explosive hip hinge." },
                { name: "Bicep Curls (Dumbbells)", sets: 3, reps: 12, notes: "Controlled movement." },
                { name: "Overhead Triceps Extensions (Dumbbell)", sets: 3, reps: 12, notes: "Full range of motion." }
            ]
        },
        "Day 6": {
            type: "Active Recovery / Stretching",
            description: "Gentle movement and static stretching.",
            exercises: [
                { name: "Light Walking", sets: 1, reps: "30 min", notes: "Outdoors if possible." },
                { name: "Yoga Poses (with Yoga Blocks)", sets: 1, reps: "15 min", notes: "Focus on flexibility." }
            ]
        },
        "Day 7": { type: "Rest", description: "Complete rest." }
    },
    // ... continue for 26 weeks ...
    // Example for Week 3 (showing progression)
    "Week 3": {
        "Day 1": {
            type: "Full Body Strength A",
            description: "Continue increasing weight or reps. Aim for challenging but maintainable.",
            exercises: [
                { name: "Goblet Squats (Kettlebell/Dumbbell)", sets: 4, reps: 10, notes: "Add a set or increase weight." },
                { name: "Dumbbell Rows (Bent-Over)", sets: 4, reps: 10, notes: "Add a set or increase weight." },
                { name: "Dumbbell Floor Press", sets: 4, reps: 10, notes: "Add a set or increase weight." },
                { name: "Plank", sets: 3, reps: "45-60 sec", notes: "Increase hold time." },
                { name: "Skipping Rope (Warm-up)", sets: 1, reps: "10 min", notes: "Warm-up." }
            ]
        },
        "Day 2": {
            type: "HIIT Cardio",
            description: "Maintain intensity.",
            exercises: [
                { name: "Skipping Rope HIIT", sets: "6 rounds", reps: "30s fast / 30s rest", notes: "Increase rounds." },
                { name: "Burpees (Modified with Push-up)", sets: 3, reps: "10-12", notes: "Full body cardio." }
            ]
        },
        "Day 3": {
            type: "Full Body Strength B",
            description: "Progression from last week.",
            exercises: [
                { name: "Romanian Deadlifts (Dumbbell/Kettlebell)", sets: 4, reps: 10, notes: "Add a set or increase weight." },
                { name: "Dumbbell Overhead Press (Standing)", sets: 4, reps: 10, notes: "Add a set or increase weight." },
                { name: "Dumbbell Lunges (Alternating)", sets: 4, reps: "8-10 per leg", notes: "Add a set or increase weight." },
                { name: "Resistance Band Crab Walks", sets: 3, reps: "10-15 steps/side", notes: "Lateral hip strength." },
                { name: "Skipping Rope (Warm-up)", sets: 1, reps: "10 min", notes: "Warm-up." }
            ]
        },
        "Day 4": { type: "Rest", description: "Complete rest." },
        "Day 5": {
            type: "Full Body Strength C (Circuit)",
            description: "Challenge with higher reps or less rest.",
            exercises: [
                { name: "Dumbbell Thrusters", sets: 3, reps: 15, notes: "Increase reps." },
                { name: "Push-ups (on knees/toes/yoga blocks)", sets: 4, reps: "AMRAP", notes: "Add a set." },
                { name: "Kettlebell Swings", sets: 3, reps: 20, notes: "Increase reps." },
                { name: "Dumbbell Hammer Curls", sets: 3, reps: 12, notes: "Alternate grip." },
                { name: "Dumbbell Kickbacks (Triceps)", sets: 3, reps: 12, notes: "Focus on contraction." }
            ]
        },
        "Day 6": {
            type: "Active Recovery / Mobility",
            description: "Focus on range of motion and recovery.",
            exercises: [
                { name: "Foam Rolling (if available)", sets: 1, reps: "15 min", notes: "Target sore areas." },
                { name: "Yoga Flow (using Yoga Blocks for support)", sets: 1, reps: "15 min", notes: "Gentle flow." }
            ]
        },
        "Day 7": { type: "Rest", description: "Complete rest." }
    },
    // --- MONTH 2: Building Volume & Intensity ---
    "Week 5": {
        "Day 1": {
            type: "Upper Body Strength A",
            description: "Starting upper/lower split.",
            exercises: [
                { name: "Dumbbell Bench Press (Floor)", sets: 4, reps: 8-12, notes: "Focus on chest." },
                { name: "Dumbbell Rows (Single-Arm)", sets: 4, reps: "8-12 per arm", notes: "Stable core." },
                { name: "Dumbbell Overhead Press (Seated)", sets: 4, reps: 8-12, notes: "Support back." },
                { name: "Bicep Curls (Dumbbell)", sets: 3, reps: 10-15 },
                { name: "Triceps Extensions (Dumbbell)", sets: 3, reps: 10-15 }
            ]
        },
        "Day 2": {
            type: "Lower Body & Core",
            description: "Leg and core focus.",
            exercises: [
                { name: "Dumbbell Squats (Front or Goblet)", sets: 4, reps: 10-15 },
                { name: "Kettlebell Romanian Deadlifts (Sumo Stance)", sets: 4, reps: 10-15 },
                { name: "Glute Bridge (Ankle Weights)", sets: 3, reps: 15-20, notes: "Use ankle weights for added resistance." },
                { name: "Leg Raises (Ankle Weights)", sets: 3, reps: 15-20, notes: "Lie on back, controlled movement." },
                { name: "Resistance Band Leg Abduction (Standing)", sets: 3, reps: "15-20 per side" }
            ]
        },
        "Day 3": {
            type: "HIIT Cardio / Skipping",
            description: "Interval training with skipping.",
            exercises: [
                { name: "Skipping Rope HIIT", sets: "8 rounds", reps: "45s fast / 30s rest", notes: "Increase work time." },
                { name: "Burpee to Overhead Press (Light Dumbbells)", sets: 3, reps: 10-12, notes: "Add a press at the top." }
            ]
        },
        "Day 4": { type: "Rest", description: "Complete rest." },
        "Day 5": {
            type: "Upper Body Strength B",
            description: "Different upper body exercises.",
            exercises: [
                { name: "Push-ups (Elevated on Yoga Blocks for deeper range)", sets: 4, reps: "AMRAP" },
                { name: "Kettlebell High Pulls", sets: 4, reps: 12-15, notes: "Explosive, use hips." },
                { name: "Dumbbell Lateral Raises", sets: 3, reps: 15-20, notes: "Focus on side delts." },
                { name: "Concentration Curls (Dumbbell)", sets: 3, reps: "10-12 per arm" },
                { name: "Overhead Triceps Extension (Single Dumbbell)", sets: 3, reps: 12-15 }
            ]
        },
        "Day 6": {
            type: "Active Recovery / Core Stability",
            description: "Focus on core and light movement.",
            exercises: [
                { name: "Bird-Dog (Yoga Blocks for support if needed)", sets: 3, reps: "10-12 per side" },
                { name: "Dead Bug", sets: 3, reps: "10-12 per side" },
                { name: "Light Jogging/Walking (outdoors)", sets: 1, reps: "30 min" }
            ]
        },
        "Day 7": { type: "Rest", description: "Complete rest." }
    },
    "Week 6": {
        "Day 1": {
            type: "Upper Body Strength A",
            description: "Progress from last week (weight/reps).",
            exercises: [
                { name: "Dumbbell Bench Press (Floor)", sets: 4, reps: 10-15 },
                { name: "Dumbbell Rows (Single-Arm)", sets: 4, reps: "10-15 per arm" },
                { name: "Dumbbell Overhead Press (Seated)", sets: 4, reps: 10-15 },
                { name: "Bicep Curls (Dumbbell)", sets: 3, reps: 12-18 },
                { name: "Triceps Dips (Chair/Bench)", sets: 3, reps: "AMRAP" }
            ]
        },
        "Day 2": {
            type: "Lower Body & Core",
            description: "Progression from last week.",
            exercises: [
                { name: "Dumbbell Squats (Front or Goblet)", sets: 4, reps: 12-18 },
                { name: "Kettlebell Romanian Deadlifts (Sumo Stance)", sets: 4, reps: 12-18 },
                { name: "Glute Bridge (Ankle Weights)", sets: 3, reps: 18-25 },
                { name: "Hanging Leg Raises (or lying leg raises with ankle weights)", sets: 3, reps: 15-20 },
                { name: "Resistance Band Clamshells", sets: 3, reps: "20-25 per side" }
            ]
        },
        "Day 3": {
            type: "HIIT Cardio / Agility",
            description: "Mix in some agility drills with skipping.",
            exercises: [
                { name: "Skipping Rope (High Knees/Double Unders attempts)", sets: 1, reps: "15 min" },
                { name: "Agility Ladder Drills (imaginary or using skipping rope on floor)", sets: 1, reps: "10 min", notes: "Quick feet, lateral shuffles." },
                { name: "Plank Jacks", sets: 3, reps: 15-20 }
            ]
        },
        "Day 4": { type: "Rest", description: "Complete rest." },
        "Day 5": {
            type: "Upper Body Strength B",
            description: "Progression.",
            exercises: [
                { name: "Push-ups (Elevated on Yoga Blocks)", sets: 4, reps: "AMRAP" },
                { name: "Kettlebell High Pulls", sets: 4, reps: 15-20 },
                { name: "Dumbbell Front Raises", sets: 3, reps: 15-20 },
                { name: "Hammer Curls (Dumbbell)", sets: 3, reps: 12-18 },
                { name: "Overhead Triceps Extension (Single Dumbbell)", sets: 3, reps: 15-20 }
            ]
        },
        "Day 6": {
            type: "Yoga/Mobility Flow",
            description: "Dedicated session for flexibility and recovery.",
            exercises: [
                { name: "Full Body Yoga Flow (use Yoga Blocks for modifications/support)", sets: 1, reps: "30-40 min", notes: "Focus on hip openers, hamstring stretches, thoracic mobility." }
            ]
        },
        "Day 7": { type: "Rest", description: "Complete rest." }
    },
    // ... continue the pattern for 6 months (approx. 26 weeks) ...
    // This is a *sample* structure. You would fill out the remaining 20 weeks with:
    // - Progressive Overload: Gradually increase reps, sets, or weight/intensity.
    // - Exercise Variation: Introduce slight variations (e.g., sumo squats, single-leg deadlifts, incline push-ups using yoga blocks).
    // - Deload Weeks: Every 4-6 weeks, a deload week (reduced volume/intensity) to aid recovery and prevent plateaus.
    // - Cardio Progression: Increase duration or intensity of HIIT/steady-state cardio.
    // - Core Progression: More challenging core exercises.
    // - Fat Loss Focus: Higher intensity circuits, more metabolic conditioning.
    // - Muscle Gain Focus: More traditional strength sets, focusing on hypertrophy ranges (e.g., 8-12 reps).
    // - Integration of all equipment.

    // --- MONTH 3-4: Increased Volume & Specificity ---
    // Introduce more sets (e.g., 4-5 sets), slightly higher reps for hypertrophy, or heavier weights for strength.
    // Continue with Upper/Lower or full body splits.
    // More complex kettlebell movements (e.g., clean & press variations).
    // Longer cardio sessions or more intense HIIT.
    // Example: "Week 9"
    "Week 9": {
        "Day 1": {
            type: "Upper Body Strength A - High Volume",
            description: "Increased sets and reps.",
            exercises: [
                { name: "Dumbbell Bench Press (Floor)", sets: 5, reps: 10-15 },
                { name: "Dumbbell Pullover (on Yoga Block for ROM)", sets: 3, reps: 15-20 },
                { name: "Dumbbell Overhead Press (Standing)", sets: 5, reps: 10-15 },
                { name: "Resistance Band Face Pulls", sets: 4, reps: 15-20 },
                { name: "Alternating Bicep Curls", sets: 3, reps: "10-12 per arm" },
                { name: "Overhead Triceps Extension (Two-hand Dumbbell)", sets: 3, reps: 12-15 }
            ]
        },
        "Day 2": {
            type: "Lower Body & Core - Strength Focus",
            description: "Heavier weights, lower rep range for strength.",
            exercises: [
                { name: "Kettlebell Goblet Squats", sets: 5, reps: 8-12 },
                { name: "Dumbbell Single-Leg Romanian Deadlifts (with support)", sets: 4, reps: "8-10 per leg" },
                { name: "Kettlebell Swings (Heavy)", sets: 4, reps: 15-20 },
                { name: "Ankle Weighted Leg Lifts (Prone)", sets: 3, reps: 15-20 },
                { name: "Resistance Band Leg Press (Loop around feet)", sets: 3, reps: 20-25 }
            ]
        },
        "Day 3": {
            type: "Interval Cardio / Skipping & Bodyweight",
            description: "Higher intensity metabolic conditioning.",
            exercises: [
                { name: "Skipping Rope (Max Effort Intervals)", sets: "10 rounds", reps: "45s sprint / 15s rest" },
                { name: "Burpee to Plank Jack Combo", sets: 4, reps: 10-12 },
                { name: "Jumping Jacks", sets: 3, reps: 30-45 }
            ]
        },
        "Day 4": { type: "Rest / Light Walk", description: "Active recovery." },
        "Day 5": {
            type: "Full Body Circuit - Conditioning",
            description: "Circuit style for fat burn and muscle endurance.",
            exercises: [
                { name: "Dumbbell Snatch (Alternating)", sets: 4, reps: "8-10 per arm" },
                { name: "Renegade Rows (Dumbbells)", sets: 4, reps: "8-10 per side" },
                { name: "Push-ups (on Dumbbells for stability)", sets: 4, reps: "AMRAP" },
                { name: "Kettlebell Front Squat", sets: 3, reps: 10-12 },
                { name: "Skipping Rope", sets: 1, reps: "10 min finish" }
            ]
        },
        "Day 6": {
            type: "Mobility & Stretching",
            description: "Deep stretching and foam rolling (if applicable).",
            exercises: [
                { name: "Long Hold Stretches (using Yoga Blocks for deeper stretches)", sets: 1, reps: "30-40 min", notes: "Focus on hamstrings, hips, shoulders." },
                { name: "Dynamic Warm-up", sets: 1, reps: "10 min" }
            ]
        },
        "Day 7": { type: "Rest", description: "Complete rest." }
    },
    // --- MONTH 5-6: Peak & Maintenance / Refinement ---
    // Introduce more advanced variations, slightly higher intensity.
    // Could include "finisher" exercises.
    // Maintain intensity for fat loss, focus on strength gains for muscle.
    // Example: "Week 20"
    "Week 20": {
        "Day 1": {
            type: "Upper Body Hypertrophy",
            description: "High volume for muscle growth.",
            exercises: [
                { name: "Dumbbell Bench Press (Floor - Drop Sets)", sets: 3, reps: "8-12 + drop" },
                { name: "Dumbbell Bent-Over Rows (Pyramid Sets)", sets: 4, reps: "12,10,8,6 (increasing weight)" },
                { name: "Arnold Press (Dumbbells)", sets: 4, reps: 10-12 },
                { name: "Dumbbell Flyes (Floor)", sets: 3, reps: 15-20 },
                { name: "Preacher Curls (Resistance Band or Dumbbell on knee)", sets: 3, reps: 15-20 },
                { name: "Overhead Triceps Extensions (Kettlebell)", sets: 3, reps: 15-20 }
            ]
        },
        "Day 2": {
            type: "Lower Body & Core - Power Focus",
            description: "Explosive movements and core stability.",
            exercises: [
                { name: "Kettlebell Goblet Squat (Tempo: 3s down, 1s up)", sets: 4, reps: 10-12 },
                { name: "Kettlebell Deadlift (Sumo or Conventional)", sets: 4, reps: 8-12, notes: "Focus on form." },
                { name: "Box Jumps (using sturdy surface/yoga blocks stacked carefully)", sets: 4, reps: 8-10 },
                { name: "Walking Lunges (with Ankle Weights)", sets: 3, reps: "10-15 per leg" },
                { name: "Plank with Leg Lift (Ankle Weights)", sets: 3, reps: "10-12 per leg" }
            ]
        },
        "Day 3": {
            type: "HIIT & Conditioning Circuit",
            description: "Maximum effort to burn fat.",
            exercises: [
                { name: "Circuit (3-4 rounds, minimal rest):", sets: 1, reps: "No rest between exercises" },
                { name: "- Skipping Rope (1 min max effort)" },
                { name: "- Burpees (10-12 reps)" },
                { name: "- Dumbbell Renegade Rows (8-10 per side)" },
                { name: "- Kettlebell Swings (20-25 reps)" },
                { name: "- Mountain Climbers (30-45 sec)" }
            ]
        },
        "Day 4": { type: "Rest", description: "Complete rest." },
        "Day 5": {
            type: "Full Body Metabolic Finisher",
            description: "High-intensity, high-volume full body session.",
            exercises: [
                { name: "Complex (perform all exercises with same dumbbell without putting it down - 3-4 rounds):", sets: 1, reps: "Minimal rest" },
                { name: "- Dumbbell Squat (10-12 reps)" },
                { name: "- Dumbbell Row (10-12 reps)" },
                { name: "- Dumbbell Clean & Press (8-10 reps)" },
                { name: "- Dumbbell Reverse Lunge (8-10 per leg)" },
                { name: "- Dumbbell Push-ups (AMRAP)" }
            ]
        },
        "Day 6": {
            type: "Long Duration Steady State Cardio / Active Recovery",
            description: "Focus on recovery and endurance.",
            exercises: [
                { name: "Skipping Rope / Brisk Walk", sets: 1, reps: "45-60 min", notes: "Steady, conversational pace." },
                { name: "Full Body Foam Roll & Static Stretch", sets: 1, reps: "20 min" }
            ]
        },
        "Day 7": { type: "Rest", description: "Complete rest." }
    }
    // ... complete up to Week 26 following this progressive overload and variation pattern.
    // Remember to integrate all equipment throughout the weeks strategically.
};
