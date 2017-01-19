import {$on} from './helpers';

import * as Nested from 'nestedtypes'

interface IShip {
	position: ShipPosition | undefined;
	readonly hp: number;
	length: number;
	readonly player: Player;	
}

var ShipModel = Nested.Model.extend({
	defaults: {
		length: 0 as number,
		hp: 0 as number,
		position: undefined as ShipPosition | undefined,
		player: "me" as Player
	},

	collection: {
		addShip(sh: {
			length: number,
			player: Player
		}) {
			let sh2 = Object.assign({hp: sh.length, position:undefined}, sh);			
			let result = new ShipModel(sh2);
			result.hp = result.length;
			this.add(result);
			return result;
		}
	}	
});

type Ship = typeof ShipModel;

function getRandomInt(min: number, max: number) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}

type ShipOrient = 'h' | 'v';

function toggle_orient(orient?: ShipOrient): ShipOrient {
	switch(orient) {
		case 'h': return 'v';
		case 'v': return 'h';
		default: return 'h';
	}
}

class ShipPosition {
	cell: Cell;
	orient: ShipOrient;
	constructor (cell: Cell, orient: ShipOrient) {
		this.cell = cell;
		this.orient = orient;
	}
}

function is_cell_valid(x: number, y: number, field: Field): boolean {
	return x >= 0 && y >= 0 && x < field.width && y < field.height;
}

function is_adj_cell(x1: number, y1:number, x2:number, y2:number, distance: number = 1): boolean {
	return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2)) <= distance;
}

function is_same_cell(x1, y1, x2, y2): boolean {
	return (x1 == x2) && (y1 == y2)
}

function ship_ends(ship_length, position) {
	let startx: number = position.cell.x;
	let endx: number = startx;
	let starty: number = position.cell.y;
	let endy: number = starty;
	switch (position.orient) {
		case 'h': endx += ship_length-1; break;
		case 'v': endy += ship_length-1; break;
		default: throw new Error('Invalid orientation');
	}
	return {startx, endx, starty, endy};
}

function ship_fit_field(ship_length: number, position: ShipPosition, field: Field): boolean {
	let {startx, endx, starty, endy} = ship_ends(ship_length, position);	
	return is_cell_valid(startx, endx, field) && is_cell_valid(starty, endy, field);
}

function is_adj_ship(ship_length1: number, 
					 position1: ShipPosition, 
					 ship_length2: number, 
					 position2: ShipPosition, 
					 field: Field): boolean {
	let {startx:startx1, endx:endx1, starty:starty1, endy:endy1} = ship_ends(ship_length1, position1);
	let {startx:startx2, endx:endx2, starty:starty2, endy:endy2} = ship_ends(ship_length2, position2);
	for (let x1 = startx1; x1 <= endx1; ++x1) {
		for (let x2 = startx2; x2 <= endx2; ++x2) {
			for (let y1 = starty1; y1 <= endy1; ++y1) {
				for (let y2 = starty2; y2 <= endy2; ++y2) {
					if (is_adj_cell(x1, y1, x2, y2)) {
						return true;
					}
				}
			}
		}
	}
	return false;
}

class Cell {
	readonly x: number;
	readonly y: number;	

	constructor(x: number, y: number) {
		this.x = x;
		this.y = y;		
	}
}



class Field {
	constructor(public width: number, public height:number) {		
	}	
}

type Player = 'me' | 'ai';

class Shot {
	constructor (readonly id, readonly cell: Cell, readonly player: Player, readonly hit: boolean) {		
	}
}

class Game {
	rules = {
		ships: [4,3,3,2,2,2,1,1,1,1],
		field: {
			width: 10,
			height: 10
		}
	}

	private shots: Shot[] = [];	
	private ships = new ShipModel.Collection();
	constructor() {		
		this.rules.ships.forEach(l => this.createShip('me', l));
		this.rules.ships.forEach(l => this.createShip('ai', l));
	}

	_field() {
		return new Field(this.rules.field.width, this.rules.field.height);
	}

	private createShip(player: Player, length: number) {		
		return this.ships.addShip({length, player});				
	}

	shipById(id): Ship {
		return this.ships.get(id);		
	}

	shipsByPlayer(player: Player): Ship[] {
		return this.ships.filter(x => x.player == player);
	}

	isValidPlacement(player: Player) {
		let ships = this.shipsByPlayer(player);
		let ships2: Ship[] = [];
		for (let sh of ships) {
			if (sh.position) {
				if (!ship_fit_field(sh.length, sh.position, this._field())) {
					return false;
				}
				if (!can_place(sh.length, sh.position, ships2, this._field())) {
					return false;
				}
				ships2.push(sh);
			}
		}
		return true;
	}

	autoplace(player: Player) {
		random_place_ships(this.shipsByPlayer(player), this._field());
	}

	shipByCell(player: Player, cell: Cell): Ship | undefined {
		for (let sh of this.shipsByPlayer(player)) {
			let {startx, endx, starty, endy} = ship_ends(sh.length, sh.position);
			for (let x = startx; x <= endx; ++x) {
				for (let y = starty; y <= endy; ++y) {
					if ((cell.x == x) && (cell.y == y)) {
						return sh;						
					}
				}
			}			
		}
		return undefined;
	}

	addShot(cell: Cell, player: Player): Shot | undefined {
		if (!is_cell_valid(cell.x, cell.y, this._field())) {
			return;
		}
		let ship = this.shipByCell(player, cell);
		let hit = !!ship;				

		let old_shot = this.shots.find(x => (x.player == player) && (x.cell.x == cell.x) && (x.cell.y == cell.y))

		if (old_shot) {
			return;
		}

		let new_id = Math.max(0, ...this.shots.map(x => x.id)) + 1;

		let new_shot = new Shot(new_id, cell, player, hit);
		this.shots.push(new_shot);

		if (ship) {
			ship.hp -=1;
			if (ship.hp <= 0) {
				let {startx, endx, starty, endy} = ship_ends(ship.length, ship.position);
				for (let x = startx-1; x <= endx+1; ++x) {
					for (let y = starty-1; y <= endy+1; ++y) {
						this.addShot(new Cell(x, y), player);
					}
				}	
			} else {
				this.addShot(new Cell(cell.x-1, cell.y-1), player);
				this.addShot(new Cell(cell.x+1, cell.y-1), player);
				this.addShot(new Cell(cell.x-1, cell.y+1), player);
				this.addShot(new Cell(cell.x+1, cell.y+1), player);
			}
		}
		return new_shot;
	}

	shotsByPlayer(player: Player): Shot[] {
		return this.shots.filter(x => x.player == player);
	}

	whichPlayerWon(): Player | undefined {
		if (this.shipsByPlayer('me').filter(x => x.hp > 0).length == 0) {
			return 'ai'
		}
		if (this.shipsByPlayer('ai').filter(x => x.hp > 0).length == 0) {
			return 'me'
		}
	}
}

let game = new Game();

function can_place(ship_length: number, pos: ShipPosition, ships: Ship[], field: Field) {
	if (!ship_fit_field(ship_length, pos, field)) {
		return false;
	}
	for (let sh of ships) {
		if (sh.position && is_adj_ship(ship_length, pos, sh.length, sh.position, field)) {
			return false;
		}
	}
	return true;
}

function all_valid_positions(ship_length: number, ships: Ship[], field: Field): ShipPosition[] {
	let result: ShipPosition[] = [];
	let orients: ShipOrient[] = ['h', 'v']; 
	for (let x = 0; x < field.width; ++x) {
		for (let y = 0; y < field.height; ++y) {
			for (let orient of orients) {
				let pos = new ShipPosition(new Cell(x, y), orient);				
				if (can_place(ship_length, pos, ships, field)) {
					result.push(pos);
				}
			}
		}
	}
	return result;
}

function random_place_ships(ships: Ship[], field: Field): Ship[] {
	let all_ships: Ship[] = ships.filter(x => !!x.position);
	let new_ships: Ship[] = ships.filter(x => !x.position);
	let result: Ship[] = [];
	for (let new_sh of new_ships) {
		let positions = all_valid_positions(new_sh.length, all_ships, field);
		var chosen_pos = positions[getRandomInt(0, positions.length)];
		new_sh.position = chosen_pos;
		all_ships.push(new_sh);
		result.push(new_sh);
	}
	return result;
}

class PlacingModel {
	
}

var renderer;
var stage;
var textures;
var gameUI;

export function main() {
	PIXI.ticker.shared.autoStart = false;
	renderer = PIXI.autoDetectRenderer(800, 600);
	renderer.backgroundColor = 0xffb6c1; // "lightpink";
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
	constructor(ship_length: number, public ship_id:number) {
		super(textures['ship_' + ship_length + '.png']);				
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
			let sh_sp = new ShipSprite(sh.length, sh.cid);
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
			let sh = game.shipById(sh_sprite.ship_id);
			if (sh) {
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
			} else {
				console.exception('No ship with id = ' + sh_sprite.ship_id);
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
	current_ship_id: number | undefined;
		
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
		if (this.current_ship_id) {
			let ship = game.shipById(this.current_ship_id);
			if (ship.position) {
				ship.position = new ShipPosition(cell, ship.position.orient);
			} else {
				ship.position = new ShipPosition(cell, 'h');
			}			
		}
	}		

	_pick_next_ship() {
		let ship = game.shipsByPlayer('me').find(x => !x.position);
		console.log('_pick_next_ship', ship);
		if (ship) {
			this.current_ship_id = ship.cid;
			this._render();
		} else {
			this.current_ship_id = undefined;	
			this.fieldView.update();
			this._render();		
			this.emit('ships_placed');
		}
	}

	_can_place() {	
		if (this.current_ship_id) {
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
		if (this.current_ship_id) {
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
		if (this.current_ship_id) {
			renderer.view.style.cursor = 'default';
			game.shipById(this.current_ship_id).position = undefined;			
			this._render();
		}
	}

	_click(e) {
		this._place();
	}

	_right_click(e) {
		if (this.current_ship_id) {
			let ship = game.shipById(this.current_ship_id); 
			if (ship.position) {
				ship.position.orient = toggle_orient(ship.position.orient);
			} else {
				ship.position = new ShipPosition(new Cell(0, 0), 'h');
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
	model: PlacingModel = new PlacingModel();
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
			let x = getRandomInt(0, game.rules.field.width);
			let y = getRandomInt(0, game.rules.field.height);
			let sh = game.addShot(new Cell(x, y), 'me');
			if (sh) {
				console.log('Shot at', x, y, sh.hit);
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


