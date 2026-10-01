import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PlayerPin } from './player-pin';

describe('PlayerPin', () => {
  let component: PlayerPin;
  let fixture: ComponentFixture<PlayerPin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlayerPin],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PlayerPin);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
