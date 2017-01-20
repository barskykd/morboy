import {$on} from './helpers';

import {Ship, ShipOrient, Game, Field, Cell, ShipPosition, Player} from './model';

function toggle_orient(orient?: ShipOrient): ShipOrient {
	switch(orient) {
		case 'h': return 'v';
		case 'v': return 'h';
		default: return 'h';
	}
}

let game = new Game();

var renderer;
var stage;
var textures;
var gameUI;

export function main() {
	PIXI.ticker.shared.autoStart = false;
	renderer = PIXI.autoDetectRenderer(800, 600);
	renderer.backgroundColor = 0xFFFFFF; // "lightpink";
	stage = new PIXI.Container();

	PIXI.loader
		.add("assets/sprites.json")
		.load(setup);

	document.body.appendChild(renderer.view);	

	renderer.view.addEventListener("contextmenu", function(e) {
            e.preventDefault();
            return false;
        });	
}

class ShipSprite extends PIXI.Sprite {		
	constructor(public readonly ship: Ship) {
		super(textures['ship_' + ship.length + '.png']);				
	}

	setOrientation(orient: ShipOrient) {
		if (orient == 'v') {						
			this.rotation = Math.PI / 2
			this.pivot.set(0, this.height);
		} else {						
			this.rotation = 0;
			this.pivot.set(0, 0);
		}
	}		
}

class FieldSprite extends PIXI.Sprite {
	field: Field = new Field(10, 10);	
	constructor() {
		super(textures['field.png']);		
	}

	pointToCell(p: PIXI.Point): Cell {
		const x = Math.floor(p.x / 20);
		const y = Math.floor(p.y / 20);
		return new Cell(x, y);
	}

	cellToPoint(c: Cell): PIXI.Point {
		return new PIXI.Point(c.x * 20, c.y * 20);
	}
}

class FieldView extends PIXI.Container {
	fieldSprite: FieldSprite;
	shipSprites: ShipSprite[] = [];
	shotSprites: {[x:number]: PIXI.Sprite}  = {};

	constructor(readonly player: Player) {
		super();

		this.fieldSprite = new FieldSprite();				
		this.fieldSprite.interactive = true;
		this.addChild(this.fieldSprite);

		for (let sh of game.shipsByPlayer(player)) {
			let sh_sp = new ShipSprite(sh);
			sh_sp.visible = false;
			this.shipSprites.push(sh_sp);
			this.addChild(sh_sp);
		}

		this.update();

		this.fieldSprite.on('mousemove', e => {
			if (e.target === this.fieldSprite) {
				let point = e.data.getLocalPosition(this);
				let cell = this.fieldSprite.pointToCell(point);
				this.emit('cell_mousemove', cell, point, e)
			}
		});

		this.fieldSprite.on('click', e => {
			if (e.target === this.fieldSprite) {
				let point = e.data.getLocalPosition(this);
				let cell = this.fieldSprite.pointToCell(point);
				this.emit('cell_click', cell, point, e)
			}
		})

		this.fieldSprite.on('rightclick', e=> {
			if (e.target === this.fieldSprite) {
				let point = e.data.getLocalPosition(this);
				let cell = this.fieldSprite.pointToCell(point);
				this.emit('cell_rightclick', cell, point, e)
			}
		})

		this.fieldSprite.on('mouseout', e=> {
			this.emit('field_mouseout', e);
		})
	}

	update() {
		for (let sh_sprite of this.shipSprites) {
			let sh = sh_sprite.ship;
			
			if (sh.position) {
				if (this.player == 'me') {
					sh_sprite.visible = true;
				} else {
					sh_sprite.visible = sh.hp <= 0;
				}
				
				sh_sprite.position = this.fieldSprite.cellToPoint(sh.position.cell)
				sh_sprite.setOrientation(sh.position.orient);
			} else {
				sh_sprite.visible = false;
			}				
		} 
		

		for (let shot of game.shotsByPlayer(this.player)) {
			let sh_sprite = this.shotSprites[shot.id];
			if (!sh_sprite) {
				let tex = shot.hit ? textures['hit.png'] : textures['miss.png'];				
				sh_sprite = new PIXI.Sprite(tex);
				this.addChild(sh_sprite);
				this.shotSprites[shot.id] = sh_sprite;
				sh_sprite.position = this.fieldSprite.cellToPoint(shot.cell);
			}
		}
	}
}

class PlaceShipsControl extends PIXI.Container {	
	fieldView: FieldView = new FieldView('me');
	current_ship_sprite?: ShipSprite;
	current_ship: Ship | undefined;
		
	constructor () {
		super();		

		this.addChild(this.fieldView);
		
		this.fieldView.on('cell_mousemove', this._cell_mousemove.bind(this));
		this.fieldView.on('cell_click', this._click.bind(this));
		this.fieldView.on('cell_rightclick', this._right_click.bind(this));
		this.fieldView.on('field_mouseout', this._mouse_out.bind(this));

		this._pick_next_ship();
	}		

	autoplace() {
		game.autoplace('me');
		this.fieldView.update();
		this._render();
		this.emit('ships_placed');
	}

	_render() {
		let ticker = PIXI.ticker.shared;
		this.fieldView.update();
		ticker.update();
	}

	_move_ship(cell: Cell) {
		if (this.current_ship) {			
			if (this.current_ship.position) {
				this.current_ship.position = new ShipPosition(cell, this.current_ship.position.orient);
			} else {
				this.current_ship.position = new ShipPosition(cell, 'h');
			}			
		}
	}		

	_pick_next_ship() {
		let ship = game.shipsByPlayer('me').find(x => !x.position);
		console.log('_pick_next_ship', ship);
		if (ship) {
			this.current_ship = ship;
			this._render();
		} else {
			this.current_ship = undefined;	
			this.fieldView.update();
			this._render();		
			this.emit('ships_placed');
		}
	}

	_can_place() {	
		if (this.current_ship) {
			return game.isValidPlacement('me');
		}
		return false;		
	}

	_place() {
		if (this._can_place()) {			
			this._pick_next_ship();			
		}	
	}

	_cell_mousemove(cell, point) {		
		if (this.current_ship) {
			this._move_ship(cell);
			if (this._can_place()) {					
				renderer.view.style.cursor = 'pointer';
			} else {
				renderer.view.style.cursor = 'not-allowed';	
			}			
			this._render();				
		}		
	}	

	_mouse_out() {
		if (this.current_ship) {
			renderer.view.style.cursor = 'default';
			this.current_ship.position = undefined;			
			this._render();
		}
	}

	_click(e) {
		this._place();
	}

	_right_click(e) {
		if (this.current_ship) {			
			if (this.current_ship.position) {
				this.current_ship.position.orient = toggle_orient(this.current_ship.position.orient);
			} else {
				this.current_ship.position = new ShipPosition(new Cell(0, 0), 'h');
			}			
			this._render();			
		}
	}
}

type BattleFinished = (result: GameResult) => void;



class PlacingUi extends PIXI.Container {	
	field: PlaceShipsControl = new PlaceShipsControl();
	autoPlaceButton: PIXI.Text;	
	current_ship: ShipSprite | null;	
	constructor() {

		super();				
		this.addChild(this.field);
		this.field.position.set(10, 60);
		this.autoPlaceButton = new PIXI.Text(
			"Place ships automatically",
			{fontFamily: "sans-serif", fontSize:"32px", fill: "Black"}
		);
		this.autoPlaceButton.interactive = true;
		this.autoPlaceButton.buttonMode = true;
		this.autoPlaceButton.position.set(300, 60);

		this.addChild(this.autoPlaceButton);		

		this.autoPlaceButton.on('click', () => this.field.autoplace());

		PIXI.ticker.shared.add(() => this.render());
		this.field.on('ships_placed', ships => this.emit('ships_placed', ships));
	}	

	render() {
		renderer.render(this)
	}			
}

type GameResult = 'WIN' | 'LOSE';

class MyBattleField extends FieldView {
	constructor() {
		super('me');
	}
}

class TheirBattleField extends FieldView {		
	constructor() {
		super('ai');
		game.autoplace('ai');
		this.update();
	}
}



class BattleUi extends PIXI.Container
{
	field1: MyBattleField;
	field2: TheirBattleField;	

	on_finished?: BattleFinished;

	constructor(ships: Ship[], on_finished?: BattleFinished){
		super();

		this.field1 = new MyBattleField();		
		this.field1.position.set(10, 60);
		
		this.addChild(this.field1);

		this.field2 = new TheirBattleField();
		this.field2.position.set(300, 60);
		this.addChild(this.field2);
		
		this.on_finished = on_finished;
		
		this.field2.on('click', this._click.bind(this));	

		this.field2.on('cell_click', cell => {
			let sh = game.addShot(cell, 'ai');
			this.field2.update();
			this.render();		
			if (sh) {
				console.log('Player shot at', cell.x, cell.y, sh.hit);
			}				
			if (sh && !sh.hit) {
				this.ai_shot();
			} 
			if (game.whichPlayerWon()) {
				this.emit('game_over');
			}
		});		

		

		this.render();		
	}

	private ai_shot() {
		while (true) {
			let c = game.randomCell();			
			let sh = game.addShot(c, 'me');
			if (sh) {
				console.log('Shot at', c.x, c.y, sh.hit);
			}
			if ((sh && !sh.hit) || game.whichPlayerWon()) {
				break;
			}
			this.field1.update();
			this.render();
		}
		this.field1.update();
		this.render();
	}

	render() {
		renderer.render(this);
	}

	_click() {
		if (this.on_finished) {
			this.on_finished('WIN');
		}
	}
}

class GameOverView extends PIXI.Container {
	constructor(message: string) {
		super();
		let text = new PIXI.Text(
			message,
			{fontFamily: "sans-serif", fontSize:"32px", fill: "Black"}
		);		
		text.position.set(300, 60);
		this.addChild(text);

		this.interactive = true;
		this.buttonMode = true;
	}
}

class GameUi
{
	stage: PIXI.Container;

	placingUi: PlacingUi | null;
	battleUi: BattleUi | null;

	myField: PIXI.Sprite;
	otherField: PIXI.Sprite;
	myShips: PIXI.Sprite[];
	otherShips: PIXI.Sprite[];
	

	splash: PIXI.Container;
	playGame: PIXI.Sprite;

	playerWon = new GameOverView('You won!');
	playerLost = new GameOverView('You lost...');

	constructor(stage) {
		this.stage = stage;

		

		this.playerWon.on('click', () => this.toSplash());
		this.playerLost.on('click', () => this.toSplash());		

			

		this.splash = new PIXI.Container();
		this.splash.buttonMode = true;
		this.splash.interactive = true;
		this.splash.on("click", () => this.toPlacing());
		this.playGame = new PIXI.Sprite(textures['play_game.png']);
		this.playGame.position.set(10, 10);
		this.splash.addChild(this.playGame);		

		this.toSplash();
	}

	placing_mouse_move() {

	}

	toSplash() {		
		game = new Game();		
		renderer.render(this.splash);		
	}

	toPlacing() {		
				
		this.placingUi = new PlacingUi();	
		this.placingUi.render();	
		this.placingUi.on('ships_placed', ships => this.toBattle(ships));
	}

	toBattle(ships: Ship[]) {
		
		this.battleUi = new BattleUi(ships);
		this.battleUi.render();
		this.battleUi.on('game_over', () => this.toGameOver());
	}

	toGameOver() {
		switch (game.whichPlayerWon()) {
			case 'ai': renderer.render(this.playerLost); break;
			case 'me': renderer.render(this.playerWon); break;
		}
	}	
}

function setup() {
	textures = PIXI.loader.resources["assets/sprites.json"].textures; 

	gameUI = new GameUi(stage);	

	//renderer.render(stage);
}



$on(window, 'load', main);


