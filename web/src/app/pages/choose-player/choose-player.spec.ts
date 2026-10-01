import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ChoosePlayer } from './choose-player';

describe('ChoosePlayer', () => {
  let component: ChoosePlayer;
  let fixture: ComponentFixture<ChoosePlayer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChoosePlayer],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ChoosePlayer);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
