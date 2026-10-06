import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GamePlay } from './game-play';

describe('GamePlay', () => {
  let component: GamePlay;
  let fixture: ComponentFixture<GamePlay>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GamePlay],
    }).compileComponents();

    fixture = TestBed.createComponent(GamePlay);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
