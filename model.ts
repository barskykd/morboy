
export class ShipPosition {
	cell: Cell;
	orient: ShipOrient;
	constructor (cell: Cell, orient: ShipOrient) {
		this.cell = cell;
		this.orient = orient;
	}
}

export type ShipOrient = 'h' | 'v';

export class Ship {
    public hp: number;
    public position: ShipPosition | undefined;
    constructor(public readonly length:number, 
                public readonly player: Player) {
        this.hp = length;
    }
}

export class Cell {
	readonly x: number;
	readonly y: number;	

	constructor(x: number, y: number) {
		this.x = x;
		this.y = y;		
	}
}



export class Field {
	constructor(public width: number, public height:number) {		
	}
}

export type Player = 'me' | 'ai';

class Shot {
	constructor (readonly id, readonly cell: Cell, readonly player: Player, readonly hit: boolean, readonly auto:boolean) {		
	}
}

export class Game {
	rules = {
		ships: [4,3,3,2,2,2,1,1,1,1],
		field: {
			width: 10,
			height: 10
		}
	}

	private shots: Shot[] = [];	
    private ships: Ship[] = [];
	constructor() {		        
		this.rules.ships.forEach(l => this.createShip('me', l));
		this.rules.ships.forEach(l => this.createShip('ai', l));        
	}

	_field() {
		return new Field(this.rules.field.width, this.rules.field.height);
	}

	private createShip(player: Player, length: number) {		
        return this.ships.push(new Ship(length, player));				
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

	addShot(cell: Cell, player: Player, auto: boolean = false): Shot | undefined {
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

		let new_shot = new Shot(new_id, cell, player, hit, auto);
		this.shots.push(new_shot);

		if (ship) {
			ship.hp -=1;
			if (ship.hp <= 0) {
				let {startx, endx, starty, endy} = ship_ends(ship.length, ship.position);
				for (let x = startx-1; x <= endx+1; ++x) {
					for (let y = starty-1; y <= endy+1; ++y) {
						this.addShot(new Cell(x, y), player, true);
					}
				}	
			} else {
				this.addShot(new Cell(cell.x-1, cell.y-1), player, true);
				this.addShot(new Cell(cell.x+1, cell.y-1), player, true);
				this.addShot(new Cell(cell.x-1, cell.y+1), player, true);
				this.addShot(new Cell(cell.x+1, cell.y+1), player, true);
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

    randomCell(): Cell {
        let x = getRandomInt(0, this.rules.field.width);
        let y = getRandomInt(0, this.rules.field.height);
        return new Cell(x, y);
    }
}


function is_adj_cell(x1: number, y1:number, x2:number, y2:number, distance: number = 1): boolean {
	return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2)) <= distance;
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

function is_cell_valid(x: number, y: number, field: Field): boolean {
	return x >= 0 && y >= 0 && x < field.width && y < field.height;
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

function getRandomInt(min: number, max: number) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
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